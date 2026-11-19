<Layout title="Crab on Workers">
    <h1>Shop</h1>
    <p class="muted">Rendered by Arc on PHP {{ $php }}, compiled to WebAssembly, inside a Cloudflare Worker.</p>

    @foreach($products as $product)
        <ProductRow :product="$product" />
    @endforeach
</Layout>
