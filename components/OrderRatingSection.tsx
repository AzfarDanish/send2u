import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { RatingInput, RatingStars } from '@/components/RatingStars';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { ErrorState } from '@/components/ui/ErrorState';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { formatOrderDate } from '@/lib/orders';
import { listOrderRatings, submitRating } from '@/services/ratings';
import type { OrderWithDetails, Rating } from '@/types/domain';

interface OrderRatingSectionProps {
  order: OrderWithDetails;
  /** Bump to refetch (e.g. realtime rating event from the other party). */
  refreshToken?: number;
  /**
   * Requester form placement. `link` (default) renders a compact entry that
   * pushes the dedicated rate screen; `inline` renders the full stars +
   * comment form (used BY the rate screen). Helpers always get the inline
   * form — their rating has no dedicated screen.
   */
  requesterForm?: 'link' | 'inline';
}

/**
 * Two-sided ratings for a completed, paid order. Renders nothing unless the
 * order is genuinely rateable (completed + verified payment, no admin
 * settlement, helper assigned) — settled-as-completed records stay
 * rating-free by design. Shows both directions' states plus the viewer's
 * submit form; submitted ratings are immutable and render read-only.
 */
export function OrderRatingSection({ order, refreshToken = 0, requesterForm = 'link' }: OrderRatingSectionProps) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const viewerRole =
    viewerId === null ? null : viewerId === order.requesterId ? 'requester' : viewerId === order.helperId ? 'helper' : null;

  const [ratings, setRatings] = useState<Rating[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const eligible =
    viewerRole !== null &&
    order.status === 'completed' &&
    order.payment?.status === 'verified' &&
    !order.resolvedAt &&
    !!order.helperId;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setRatings(await listOrderRatings(order.id));
    } catch (err) {
      setRatings(null);
      setLoadError(err instanceof Error ? err.message : 'Could not load ratings.');
    }
  }, [order.id]);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listOrderRatings(order.id);
        if (!cancelled) setRatings(rows);
      } catch (err) {
        if (!cancelled) {
          setRatings(null);
          setLoadError(err instanceof Error ? err.message : 'Could not load ratings.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eligible, order.id, refreshToken]);

  const handleSubmit = useCallback(async () => {
    if (score === null || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // The RPC returns the full immutable row — append it directly instead
      // of refetching the list. The form flips to its read-only state with
      // no flash; failure keeps the form (nothing to roll back) with error.
      const created = await submitRating(order.id, score, comment.trim().length > 0 ? comment : null);
      setRatings((prev) => (prev ? [...prev, created] : [created]));
      setScore(null);
      setComment('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit the rating.');
    } finally {
      setSubmitting(false);
    }
  }, [score, submitting, order.id, comment]);

  if (!eligible || viewerId === null) return null;

  const mine = ratings?.find((rating) => rating.fromUserId === viewerId) ?? null;
  const theirs = ratings?.find((rating) => rating.fromUserId !== viewerId) ?? null;
  const otherLabel = viewerRole === 'requester' ? 'Helper' : 'Requester';

  return (
    <Card>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={24} color={colors.primary} />
        </View>
        <View style={styles.identityText}>
          <Text variant="subtitle">Rate your helper</Text>
          {order.helperId ? (
            <Text variant="caption" color="secondary">
              Helper {order.helperId.slice(0, 8)}… · delivered your request
            </Text>
          ) : null}
        </View>
      </View>
      {loadError ? (
        <ErrorState title="Couldn't load ratings" message={loadError} retryTitle="Try again" onRetry={() => void load()} />
      ) : null}
      {mine ? (
        <View style={styles.block}>
          <Text color="secondary">You rated {mine.score} out of 5</Text>
          <RatingStars score={mine.score} />
          {mine.comment ? <Text color="secondary">{mine.comment}</Text> : null}
          <Text variant="caption" color="muted">
            Submitted {formatOrderDate(mine.createdAt)} · cannot be changed.
          </Text>
        </View>
      ) : viewerRole === 'requester' && requesterForm === 'link' ? (
        // Requesters rate on the dedicated screen (stars + comment + helper
        // identity in one guided flow); compact entries stay a link there.
        <View style={styles.block}>
          <Text color="secondary">How was your helper? Share your experience.</Text>
          <Button
            title="Rate your helper"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/(requester)/orders/[id]/rate', params: { id: order.id } })
            }
          />
        </View>
      ) : (
        <View style={styles.block}>
          <Text color="secondary">
            {viewerRole === 'requester'
              ? 'How was your helper? Rate them below.'
              : 'How was your requester? Rate them below.'}
          </Text>
          <RatingInput value={score} onChange={setScore} disabled={submitting} />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Feedback for the record (optional)"
            placeholderTextColor={colors.muted}
            maxLength={500}
            editable={!submitting}
            style={styles.commentInput}
            accessibilityLabel="Rating feedback"
          />
          <Text variant="caption" color="muted">
            {comment.length}/500
          </Text>
          {submitError ? (
            <ErrorState title="Could not submit" message={submitError} retryTitle="Dismiss" onRetry={() => setSubmitError(null)} />
          ) : null}
          <Button
            title={submitting ? 'Submitting…' : 'Submit rating'}
            onPress={() => void handleSubmit()}
            disabled={submitting || score === null}
            loading={submitting}
          />
          <Text variant="caption" color="muted">
            One rating per order — it becomes a permanent part of the record.
          </Text>
        </View>
      )}
      {theirs ? (
        <View style={styles.block}>
          <Text color="secondary">
            {otherLabel} rated {theirs.score} out of 5
          </Text>
          <RatingStars score={theirs.score} />
          {theirs.comment ? <Text color="secondary">{theirs.comment}</Text> : null}
        </View>
      ) : (
        <Text variant="caption" color="muted">
          Waiting for the {otherLabel === 'Helper' ? 'helper' : 'requester'} rating.
        </Text>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: spacing.xs },
  commentInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
