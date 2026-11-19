<?php
/**
 * @var array<string, string> $runtime
 * @var array<string, string> $isolate
 * @var list<string> $extensions
 * @var array<string, string> $headers
 */
$table = static function (array $rows): string {
    $html = '<table>';
    foreach ($rows as $name => $value) {
        $html .= '<tr><th>' . e($name) . '</th><td>' . e($value) . '</td></tr>';
    }
    return $html . '</table>';
};
?>
<style>
    table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; font-size: .875rem; }
    th, td { text-align: left; vertical-align: top; padding: .35rem .5rem; border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
    th { width: 40%; font-weight: 600; }
    td { word-break: break-all; }
</style>
<h1>Debug</h1>
<p class="muted">
    <a href="/debug/phpinfo">phpinfo()</a> ·
    <a href="/raw">The same shop in plain PHP</a> ·
    Reload: a count of 1 means this request started a new isolate.
</p>

<h2>Runtime</h2>
<?= $table($runtime) ?>

<h2>This isolate</h2>
<?= $table($isolate) ?>

<h2>Extensions (<?= e(count($extensions)) ?>)</h2>
<p><?= e(implode(', ', $extensions)) ?></p>

<h2>Request headers</h2>
<?= $table($headers) ?>
