<?php

declare(strict_types=1);

namespace App\Actions;

use App\Catalog;
use App\Http\OrderInput;
use Crab\Http\Response;

/**
 * POST /api/orders: a pretend order. Nothing is stored; the answer shows what a real one would hold.
 */
final readonly class PlaceOrder
{
    public function __construct(private Catalog $catalog) {}

    public function handle(OrderInput $input): Response
    {
        $product = $this->catalog->find($input->product_id);
        if ($product === null) {
            return Response::json(['message' => 'No such product.'], 404);
        }
        if ($product->stock < $input->quantity) {
            return Response::json(['message' => "Only {$product->stock} left in stock."], 409);
        }

        return Response::created([
            'data' => [
                'id' => 'ord_' . bin2hex(random_bytes(6)),
                'product' => $product->name,
                'quantity' => $input->quantity,
                'total' => '$' . number_format($product->priceCents * $input->quantity / 100, 2),
                'email' => $input->email,
                'status' => 'pretend',
            ],
        ]);
    }
}
