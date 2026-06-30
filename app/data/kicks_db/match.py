"""Utilities for validating KicksDB search results.

KicksDB search is a fuzzy text search — for internal/non-standard SKUs it
frequently returns the wrong product entirely. These helpers validate that a
returned product actually matches the item we asked for, and detect StockX
placeholder images so we can fall through to GOAT.
"""

import re

_STOP = frozenset({
    'the', 'x', 'and', 'in', 'of', 'a', 'an', 'with', 'by', 'for',
    'de', 'le', 'la', 'les',
})

_SX_PLACEHOLDER = 'Product-Placeholder-Default'

# Minimum Jaccard similarity to accept a search result as the correct item.
# Jaccard = |intersection| / |union|, which penalises results that share a
# common model-family prefix but differ in the distinguishing words.
#
# Example: "Supreme TNF Nuptse Jacket Yellow" vs "Supreme TNF Leaves Nuptse Sweatpants Black"
#   intersection={supreme,north,face,nuptse}=4, union=9 → Jaccard=0.44 → REJECTED
# vs "adidas Yeezy Boost 350 V2 Onyx" vs "adidas Yeezy Boost 350 V2 Onyx"
#   intersection=union=6 → Jaccard=1.0 → ACCEPTED
MATCH_THRESHOLD = 0.45


def _tokens(name: str) -> frozenset[str]:
    return frozenset(re.sub(r'[^a-z0-9]', ' ', name.lower()).split()) - _STOP


def names_overlap(a: str, b: str) -> float:
    """Return Jaccard similarity of meaningful tokens between two product names."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def is_match(item_name: str, result: dict) -> bool:
    """Return True if a KicksDB result is likely the correct product."""
    result_name = result.get('title') or result.get('name') or ''
    return names_overlap(item_name, result_name) >= MATCH_THRESHOLD


def is_placeholder(url: str | None) -> bool:
    """Return True if a StockX image URL is the generic placeholder."""
    return not url or _SX_PLACEHOLDER in url


def best_image(*urls: str | None) -> str | None:
    """Return the first non-None, non-placeholder URL, or None."""
    for url in urls:
        if url and not is_placeholder(url):
            return url
    return None


def validated_search(search_fn, sku: str, name: str) -> dict | None:
    """Search by SKU first, then by name, validating each result.

    Returns the first result whose name sufficiently overlaps with `name`,
    or None if no valid match is found.
    """
    # SKU search
    result = search_fn(sku)
    if result is not None and is_match(name, result):
        return result

    # Name search (only if different from SKU)
    if name and name.strip() != sku.strip():
        result = search_fn(name)
        if result is not None and is_match(name, result):
            return result

    return None
