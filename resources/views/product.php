<?php /** @var \App\Product $product */ ?>
<h1><?= e($product->name) ?></h1>
<p><?= e($product->description) ?></p>
<p class="price"><?= e($product->price()) ?></p>
<?php if ($product->stock > 0): ?>
    <p class="muted"><?= e($product->stock) ?> in stock</p>
<?php else: ?>
    <p class="muted">Sold out</p>
<?php endif ?>
<p class="muted">The same product as JSON: <a href="/api/products/<?= e($product->id) ?>"><code>/api/products/<?= e($product->id) ?></code></a></p>
