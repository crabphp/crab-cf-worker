<?php

declare(strict_types=1);

namespace App\Actions;

use App\Catalog;
use Crab\Http\Response;

/**
 * The home page: every product, rendered by Arc.
 */
final readonly class ShowHome
{
    public function __construct(private Catalog $catalog) {}

    public function handle(): Response
    {
        return view('home', [
            'products' => $this->catalog->all(),
            'php' => PHP_VERSION,
        ]);
    }
}
