<?php
use App\Product;
?>
@props(Product $product)
<div class="product">
    <div>
        <a href="/products/{{ $product->id }}">{{ $product->name }}</a>
        <div class="muted">{{ $product->description }}</div>
    </div>
    <div class="price">{{ $product->price() }}</div>
</div>
