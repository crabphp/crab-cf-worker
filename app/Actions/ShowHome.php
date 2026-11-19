<?php

declare(strict_types=1);

namespace App\Actions;

use App\Catalog;
use App\Page;
use Crab\Http\Response;

/**
 * The home page: every product.
 */
final readonly class ShowHome
{
    public function __construct(private Catalog $catalog) {}

    public function handle(): Response
    {
        return Page::render('home', 'Crab on Workers', [
            'products' => $this->catalog->all(),
            'php' => PHP_VERSION,
        ]);
    }
}
