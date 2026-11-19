<?php /** @var string $title @var string $body */ ?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title) ?></title>
    <style>
        :root { color-scheme: light dark; }
        body { font: 16px/1.5 system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; }
        a { color: inherit; }
        header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2rem; }
        header a { text-decoration: none; font-weight: 600; }
        .product { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
        .muted { opacity: .65; font-size: .875rem; }
        .price { font-variant-numeric: tabular-nums; white-space: nowrap; }
        code { font-size: .875rem; }
    </style>
</head>
<body>
    <header>
        <a href="/">Crab on Workers</a>
        <span class="muted"><a href="/api/products">/api/products</a></span>
    </header>
    <main><?= $body ?></main>
</body>
</html>
