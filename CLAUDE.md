# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is **Ella** (v6.7.6), a purchased Shopify theme (not Dawn) — much larger and more feature-rich than Dawn out of the box: 146+ sections, 393+ snippets, native wishlist, quick-view, compare, multiple collection/product page layout variants, and heavy use of jQuery-based global JS (`assets/theme.js`, `assets/global.js`) rather than Dawn's lightweight custom-element-only approach.

This theme is being used as a sandbox to prototype conversion-rate-optimization (CRO) changes inspired by hotpackwebstore.com, for eventual handoff to (or implementation by) the user's office dev team. It superseded an earlier Dawn-based prototype (`../my-first-theme`, now deleted) — always assume **Ella** is the active theme for this work unless told otherwise.

## Commands

Same Shopify CLI workflow as any theme, run from this directory:

```sh
shopify theme dev --store=sab-dev-store.myshopify.com              # local dev + live preview
shopify theme push --theme=160767541485 --store=... --allow-live    # Ella (#160767541485) is the LIVE theme
                                                                      # on this store, hence --allow-live
shopify theme check                                                 # lint (this theme has ~560 pre-existing
                                                                      # errors/~1200 warnings from the original
                                                                      # purchase — always filter theme check
                                                                      # output to only the files you touched)
```

**Always ask for confirmation before running `theme push`** — established workflow preference. `sab-dev-store.myshopify.com` is a test/dev-partner store; this holds even though Ella is set as its **live** theme (the user published it deliberately) — don't add extra caution beyond the normal confirm-before-push step just because a theme's role is "live" here.

`theme dev` sessions on this large theme occasionally throw a transient `"<file>.tmp.<pid>.<hash>" contains illegal characters` / `Must have a .liquid file extension` upload error right after an edit (the file watcher catches an in-progress atomic write), and the session can also 401 after running ~1hr+ (stale auth). Both fixed by killing and restarting `theme dev`, not by changing the edited files.

## Architecture patterns specific to this theme

- **Layout-switch dispatchers, not per-section variants.** Several core pieces (product card, product page, collection grid) are implemented as a `case` statement over one **global** theme setting that picks between numbered variant snippets. Example: `snippets/product-grid-layout.liquid` does `case settings.product_card_layout` → renders `product-card.liquid` (`'01'`) through `product-card-08.liquid`, plus our added **`product-card-09.liquid`** (`'09'`, set as the live default in `config/settings_data.json`). When asked to change "the product card" or "the product page," find the relevant dispatcher and active variant number first — don't assume `product-card.liquid` (the `'01'` variant) is what's live.
- **Global settings drive most customization**, not per-section settings — e.g. `settings.show_wishlist`, `settings.show_quick_view`, `settings.show_compare`, `settings.product_card_layout` all live in `config/settings_schema.json`/`settings_data.json` and affect rendering theme-wide. Check there before assuming a feature needs new per-section schema.
- **Native features to check before rebuilding anything:** wishlist (heart icon + dedicated wishlist page, localStorage-based, `assets/theme.js` + `snippets/product-card*.liquid` + `sections/main-wishlist-page.liquid`), quick-view, compare, volume/quantity price breaks, an announcement bar with cookie-based dismissal (`sections/announcement-bar.liquid`) used as the promo banner. This theme already ships more than Dawn does — confirm a gap actually exists before adding new code.
- **JS is jQuery + global, not per-section custom elements.** `assets/theme.js` and `assets/global.js` are loaded theme-wide via `snippets/global-script-2.liquid` (included from `layout/theme.liquid`) and contain most cart/quantity/variant logic, hardwired to specific markup/data-attribute conventions (e.g. `UpdateQuantity` in `global.js` expects a cart **line key**, not a pre-add variant id — it cannot be reused as-is for "add to cart" buttons; new pre-add quantity UI needs its own small custom element, as `assets/card-quantity.js` does for `product-card-09`).
- **Schema gotchas this theme's purchased base violates in places, but new code should not:** `range` settings need ≥3 distinct steps ((max−min)/step + 1 ≥ 3); `richtext`/`inline_richtext` setting *values* need real HTML (`<p>...</p>` etc.), not plain strings — both only surface as upload-time errors, not `theme check` warnings, so always do a real `theme dev` upload + HTML fetch to verify new schema, not just lint.
- Translation keys: many keys referenced in this theme's own code don't actually exist in `locales/en.default.json` (pre-existing issue, ~3 such gaps hit while building `product-card-09`). When adding new UI text, verify the key exists with a quick grep before using `| t` — if it doesn't, use a plain string rather than introducing another broken `t:`/`| t` reference.
- **Don't reuse Ella's native class names on new markup, even when copying its structure for reference.** `assets/component-card.css` is a single global stylesheet with rules keyed on generic-looking class names (`.card-product__group`, `.card-wishlist`, `.card-quickview`, `.card-compare`, `.compare-icon`, `.compare-label`, ...) that apply theme-wide to *any* element carrying them — including new custom markup, regardless of which CSS file you intended to control it. Hit this twice building `product-card-09`: (1) reusing `.compare-icon`/`.compare-label` produced two mismatched nested circles, because the global stylesheet sizes `.compare-icon` (36px) independently of whatever sizes the inner `.compare-label` is given; (2) reusing `.card-product__group`/`.card-wishlist`/`.card-quickview` silently inherited a desktop-only `@media` block that hides those classes by default and only reveals them on `.card:hover` — invisible by reading the new CSS file alone, since that file never declares any `opacity`/`visibility` rule itself. Fix pattern in both cases: rename to card-09-scoped classes (e.g. `card-09__actions`, `card-09__compare-label`) so nothing in the native stylesheet can match, rather than trying to out-specificity or override the native rule. When adding new elements to any card variant, grep `assets/component-card*.css` for the class name first.

## Current CRO customizations (this project)

- `sections/trust-badges.liquid` — new standalone collection-page section (Ella only had this pattern as a per-product-page block, `custom_information`, in `main-product.liquid`; reused its rendering snippet `snippets/product-custom-information.liquid`).
- `sections/header-group.json` → `announcement-bar` — repurposed as the promo banner (native dismiss-by-cookie behavior, no new code).
- `snippets/product-card-09.liquid` + `assets/component-card-09.css` + `assets/card-quantity.js` — new product card layout, set live via `config/settings_data.json`'s `product_card_layout: "09"`. Current behavior:
  - 3 floating action icons (wishlist, quick view, cart), **always visible** (not hover-only) on both desktop and mobile, plus a separately-scoped compare button (`card-09__compare*` classes — see the class-collision gotcha above for why it's not built like the other three).
  - The floating cart icon is the **sole** add-to-cart trigger — there is no separate "Add to Cart" button below the image.
  - Below the image: nothing shows until the product is actually added to cart (synced from `cart.js` on load, scoped per card/variant) — then a `[-] qty [+]` stepper appears; decrementing from 1 removes the line and hides the stepper again. Never shows `[-] 0 [+]`.
  - SKU, price, and an inline variant-title `<select>` (only for multi-variant products) are wrapped in fixed-`min-height` containers so every card in a grid row stays the same total height regardless of whether that particular product has variants.
