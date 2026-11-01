"""Count every labelled query, including unavailable results; names are not IDs."""
from collections import Counter


def fraction(numerator, denominator):
    return numerator / denominator if denominator else None


def summarize(predictions):
    groups = {}
    for kind in ('known', 'unknown_cat', 'no_cat'):
        rows = [p for p in predictions if p['kind'] == kind]
        statuses = Counter(p['result']['status'] for p in rows)
        group = {'n': len(rows), 'statuses': dict(statuses)}
        if kind == 'known':
            top1 = sum(p['ranking'][:1] == [p['expected_reference_id']] for p in rows)
            top3 = sum(p['expected_reference_id'] in p['ranking'][:3] for p in rows)
            correct = sum(p['confirmed_correct'] for p in rows)
            group.update(top1=top1, top3=top3, top1_rate=fraction(top1, len(rows)),
                         top3_rate=fraction(top3, len(rows)), confirmed_correct=correct,
                         confirmed_wrong=statuses['confirmed'] - correct,
                         false_rejection_rate=fraction(statuses['unknown'], len(rows)),
                         not_correctly_confirmed_rate=fraction(len(rows) - correct, len(rows)))
        else:
            group.update(false_accepts=statuses['confirmed'],
                         false_accept_rate=fraction(statuses['confirmed'], len(rows)),
                         candidate_exposure_rate=fraction(statuses['uncertain'], len(rows)))
        groups[kind] = group
    confirmed = sum(p['result']['status'] == 'confirmed' for p in predictions)
    correct = sum(p['confirmed_correct'] for p in predictions)
    return {'total': len(predictions), 'groups': groups,
            'confirmed': confirmed, 'confirmed_correct': correct,
            'confirmed_precision': fraction(correct, confirmed),
            'unavailable': sum(p['result']['status'] == 'unavailable' for p in predictions)}
