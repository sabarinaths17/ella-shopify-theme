/*
 * Product card 09: floating cart icon <-> quantity stepper toggle.
 * The floating cart icon (in the card's action group) is the sole add-to-cart
 * trigger - there is no separate "Add to Cart" button. The stepper stays
 * hidden until the first add, and never renders [-] 0 [+]: decrementing from
 * 1 removes the cart line and hides the stepper again.
 */
(function () {
    var cartPromise = null;

    function getCart() {
        if (!cartPromise) {
            cartPromise = fetch(window.Shopify.routes.root + 'cart.js')
                .then(function (response) { return response.json(); });
        }
        return cartPromise;
    }

    function refreshCart() {
        cartPromise = fetch(window.Shopify.routes.root + 'cart.js')
            .then(function (response) { return response.json(); });
        return cartPromise;
    }

    function dispatchCartUpdate(cart) {
        document.dispatchEvent(new CustomEvent('cart-update', { detail: cart }));
    }

    class ProductCardQuantity extends HTMLElement {
        connectedCallback() {
            this.stepper = this.querySelector('[data-qty-minus]')?.closest('.card-09__stepper');
            this.qtyValue = this.querySelector('[data-qty-value]');
            this.minusButton = this.querySelector('[data-qty-minus]');
            this.plusButton = this.querySelector('[data-qty-plus]');

            this.card = this.closest('.product-item-09');
            this.quickCartButton = this.card?.querySelector('[data-card-quick-add]');
            this.variantSelect = this.card?.querySelector('[data-variant-select]');

            this.lineKey = null;
            this.quantity = 0;

            this.quickCartButton?.addEventListener('click', this.handleAddToCart.bind(this));
            this.minusButton.addEventListener('click', this.handleMinus.bind(this));
            this.plusButton.addEventListener('click', this.handlePlus.bind(this));
            this.variantSelect?.addEventListener('change', this.handleVariantChange.bind(this));

            this.syncFromCart();
        }

        get variantId() {
            return this.variantSelect ? this.variantSelect.value : this.dataset.variantId;
        }

        syncFromCart() {
            var self = this;
            getCart()
                .then(function (cart) {
                    var item = cart.items.find(function (line) {
                        return String(line.variant_id) === String(self.variantId);
                    });
                    if (item) {
                        self.lineKey = item.key;
                        self.setQuantity(item.quantity);
                    } else {
                        self.setQuantity(0);
                    }
                })
                .catch(function (error) {
                    console.error('Error syncing cart state:', error);
                    self.setQuantity(0);
                });
        }

        setQuantity(quantity) {
            this.quantity = quantity;
            if (quantity > 0) {
                this.stepper.hidden = false;
                this.qtyValue.textContent = quantity;
            } else {
                this.stepper.hidden = true;
            }
        }

        handleAddToCart(event) {
            event.preventDefault();
            var self = this;
            fetch(window.Shopify.routes.root + 'cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ id: this.variantId, quantity: 1 }),
            })
                .then(function (response) { return response.json(); })
                .then(function (item) {
                    self.lineKey = item.key;
                    self.setQuantity(item.quantity);
                    return refreshCart();
                })
                .then(function (cart) { dispatchCartUpdate(cart); })
                .catch(function (error) { console.error('Error adding to cart:', error); });
        }

        handlePlus() {
            this.changeQuantity(this.quantity + 1);
        }

        handleMinus() {
            this.changeQuantity(this.quantity - 1);
        }

        changeQuantity(newQuantity) {
            if (!this.lineKey) return;
            var self = this;
            fetch(window.Shopify.routes.root + 'cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ id: this.lineKey, quantity: newQuantity }),
            })
                .then(function (response) { return response.json(); })
                .then(function (cart) {
                    if (newQuantity <= 0) {
                        self.lineKey = null;
                        self.setQuantity(0);
                    } else {
                        self.setQuantity(newQuantity);
                    }
                    dispatchCartUpdate(cart);
                })
                .catch(function (error) { console.error('Error updating cart quantity:', error); });
        }

        handleVariantChange() {
            this.dataset.variantId = this.variantId;

            var jsonHolder = this.card?.dataset.jsonProduct;
            if (jsonHolder) {
                try {
                    var productData = JSON.parse(jsonHolder);
                    var variant = productData.variants.find(function (v) {
                        return String(v.id) === String(this.variantId);
                    }, this);
                    if (variant) {
                        var skuEl = this.card.querySelector('[data-card-sku]');
                        if (skuEl) {
                            var valueEl = skuEl.querySelector('.card-09__sku-value');
                            if (variant.sku) {
                                valueEl.textContent = variant.sku;
                                skuEl.hidden = false;
                            } else {
                                skuEl.hidden = true;
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error parsing product data:', error);
                }
            }

            this.lineKey = null;
            this.syncFromCart();
        }
    }

    if (!customElements.get('product-card-quantity')) {
        customElements.define('product-card-quantity', ProductCardQuantity);
    }
})();
