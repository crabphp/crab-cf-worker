<?php

declare(strict_types=1);

namespace App;

final readonly class Product
{
    public function __construct(
        public int $id,
        public string $name,
        public string $description,
        public int $priceCents,
        public int $stock,
    ) {}

    public function price(): string
    {
        return '$' . number_format($this->priceCents / 100, 2);
    }
}
