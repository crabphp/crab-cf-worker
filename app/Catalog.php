<?php

declare(strict_types=1);

namespace App;

/**
 * The products, made up and kept in code: PHP inside a Worker cannot open a MySQL connection.
 * A real application would read them from Cloudflare D1 through PDO's cfd1 driver.
 */
final class Catalog
{
    /** @var array<int, Product> */
    private array $products;

    public function __construct()
    {
        $rows = [
            [1, 'Hermit Mug', 'A stoneware mug that keeps coffee warm through a long deploy.', 1800, 42],
            [2, 'Fiddler Notebook', 'Dot-grid pages, lay-flat binding, one oversized claw on the cover.', 1200, 130],
            [3, 'Coconut Backpack', 'Carries a laptop, a charger and far more than it should.', 8900, 7],
            [4, 'Ghost Crab Lamp', 'A warm desk light that dims itself after midnight.', 4500, 0],
            [5, 'Blue Swimmer Socks', 'Merino, in the exact blue of a failing test turned green.', 1500, 64],
        ];
        $this->products = [];
        foreach ($rows as [$id, $name, $description, $priceCents, $stock]) {
            $this->products[$id] = new Product($id, $name, $description, $priceCents, $stock);
        }
    }

    /**
     * @return list<Product>
     */
    public function all(): array
    {
        return array_values($this->products);
    }

    public function find(int $id): ?Product
    {
        return $this->products[$id] ?? null;
    }
}
