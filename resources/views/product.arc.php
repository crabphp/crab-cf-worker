<Layout :title="$product->name">
    <h1>{{ $product->name }}</h1>
    <p>{{ $product->description }}</p>
    <p class="price">{{ $product->price() }}</p>
    @if($product->stock > 0)
        <p class="muted">{{ $product->stock }} in stock</p>
    @else
        <p class="muted">Sold out</p>
    @endif
    <p class="muted">The same product as JSON: <a href="/api/products/{{ $product->id }}"><code>/api/products/{{ $product->id }}</code></a></p>
</Layout>
