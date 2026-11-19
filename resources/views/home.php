<?php /** @var list<\App\Product> $products @var string $php */ ?>
<h1>Shop</h1>
<p class="muted">Rendered on PHP <?= e($php) ?>, compiled to WebAssembly, inside a Cloudflare Worker.</p>

<?php foreach ($products as $product): ?>
    <div class="product">
        <div>
            <a href="/products/<?= e($product->id) ?>"><?= e($product->name) ?></a>
            <div class="muted"><?= e($product->description) ?></div>
        </div>
        <div class="price"><?= e($product->price()) ?></div>
    </div>
<?php endforeach ?>
