"""Utilities for validating KicksDB search results.

KicksDB search is a fuzzy text search — for internal/non-standard SKUs it
frequently returns the wrong product entirely. These helpers validate that a
returned product actually matches the item we asked for, and detect StockX
placeholder images so we can fall through to GOAT.

Matching uses two independent checks that must both pass:

  1. Jaccard similarity ≥ 0.60
     Intersection / union of meaningful tokens.  Rejects products that share
     a brand/collab prefix but differ in the key product words.
     Example: "Supreme TNF Nuptse Jacket Yellow" vs "Supreme TNF Nuptse Sweatpants"
       {supreme,north,face,nuptse} ∩ {supreme,north,face,nuptse,jacket,yellow,sweatpants}
       = 4/7 = 0.571 → REJECTED

  2. Colorway guard
     If both names contain color tokens, at least one must be shared.
     Prevents "Jacket Yellow" from matching "Jacket Black" even when
     the Jaccard score would otherwise pass.
"""

import re

_STOP = frozenset({
    'the', 'x', 'and', 'in', 'of', 'a', 'an', 'with', 'by', 'for',
    'de', 'le', 'la', 'les',
})

# Common colorway tokens.  Includes some sneaker-specific names (onyx, zebra,
# bred, chicago, …) that are meaningfully discriminating.
_COLORS = frozenset({
    'yellow', 'black', 'white', 'red', 'blue', 'grey', 'gray',
    'green', 'purple', 'orange', 'pink', 'brown', 'cream', 'tan',
    'navy', 'beige', 'silver', 'gold', 'olive', 'maroon', 'coral',
    'teal', 'indigo', 'khaki', 'onyx', 'zebra', 'natural', 'bred',
    'chicago', 'shadow', 'infrared', 'volt', 'sail', 'bone', 'stone',
    'mocha', 'wheat', 'rust', 'pine', 'jade', 'coral', 'crimson',
})

_SX_PLACEHOLDER = 'Product-Placeholder-Default'

# Minimum Jaccard similarity to accept a search result as the correct item.
MATCH_THRESHOLD = 0.60


def _tokens(name: str) -> frozenset[str]:
    return frozenset(re.sub(r'[^a-z0-9]', ' ', name.lower()).split()) - _STOP


def _color_tokens(name: str) -> frozenset[str]:
    return _tokens(name) & _COLORS


def names_overlap(a: str, b: str) -> float:
    """Return Jaccard similarity of meaningful tokens between two product names."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def is_match(item_name: str, result: dict) -> bool:
    """Return True if a KicksDB result is likely the correct product.

    Both conditions must hold:
      1. Jaccard similarity ≥ MATCH_THRESHOLD
      2. Colorway guard: if both names name a color, they must share one
    """
    result_name = result.get('title') or result.get('name') or ''
    if names_overlap(item_name, result_name) < MATCH_THRESHOLD:
        return False
    # Colorway guard — only fires when BOTH sides have explicit color tokens
    ec = _color_tokens(item_name)
    rc = _color_tokens(result_name)
    if ec and rc and not (ec & rc):
        return False
    return True


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
