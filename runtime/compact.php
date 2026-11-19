<?php

// Executed by the target PHP after acceptance, not by host PHP. Bundle only
// classes actually loaded, with dependencies before their users. Preserve file
// constants; do not change application or framework sources on disk.
$files = [];
$seen = [];
$visit = function (string $name) use (&$visit, &$files, &$seen): void {
    if (isset($seen[$name])) return;
    $seen[$name] = true;
    $r = new ReflectionClass($name);
    if ($r->isInternal()) return;
    if ($parent = $r->getParentClass()) $visit($parent->getName());
    foreach ($r->getInterfaceNames() as $interface) $visit($interface);
    foreach ($r->getTraitNames() as $trait) $visit($trait);
    // PHP may autoload return/parameter classes while checking covariance.
    $visitType = function (?ReflectionType $type) use (&$visitType, &$visit): void {
        if ($type === null) return;
        if (!$type instanceof ReflectionNamedType) {
            foreach ($type->getTypes() as $member) $visitType($member);
            return;
        }
        $name = $type->getName();
        if (!$type->isBuiltin() && (class_exists($name, false) || interface_exists($name, false))) $visit($name);
    };
    foreach ($r->getMethods() as $method) {
        $visitType($method->getReturnType());
        foreach ($method->getParameters() as $parameter) $visitType($parameter->getType());
    }
    $file = $r->getFileName();
    if ($file && !str_contains($file, '/vendor/composer/')) $files[$file] = true;
};
foreach ([...get_declared_interfaces(), ...get_declared_traits(), ...get_declared_classes()] as $class) $visit($class);

$bundle = "<?php\ndeclare(strict_types=1);\n";
foreach (array_keys($files) as $file) {
    $source = file_get_contents($file);
    // strict_types is a file-level setting. Do not silently change coercion
    // semantics for non-strict dependencies (notably some PSR packages).
    // Their original files remain available through Composer's autoloader.
    if (!preg_match('/declare\\s*\\(\\s*strict_types\\s*=\\s*1\\s*\\)\\s*;/', $source)) continue;
    $tokens = token_get_all($source);
    $text = '';
    $namespace = false;
    for ($i = 0; $i < count($tokens); $i++) {
        $token = $tokens[$i];
        if (!is_array($token)) { $text .= $token; continue; }
        [$kind, $value] = $token;
        if ($kind === T_OPEN_TAG) continue;
        if ($kind === T_CLOSE_TAG || $kind === T_INLINE_HTML) throw new Exception("Not a class-only file: $file");
        if ($kind === T_DECLARE) {
            while ($tokens[$i] !== ';') $i++;
            continue;
        }
        if ($kind === T_NAMESPACE) {
            $namespace = true;
            $text .= 'namespace ';
            while ($tokens[++$i] !== ';') {
                if ($tokens[$i] === '{') throw new Exception("Already braced namespace: $file");
                $text .= is_array($tokens[$i]) ? $tokens[$i][1] : $tokens[$i];
            }
            $text .= " {\n";
            continue;
        }
        $text .= match ($kind) {
            T_DIR => var_export(dirname($file), true),
            T_FILE => var_export($file, true),
            default => $value,
        };
    }
    $bundle .= ($namespace ? '' : "namespace {\n") . $text . "\n}\n";
}
file_put_contents('/app/classes.php', $bundle);
file_put_contents('/tmp/trace.json', json_encode([
    'extensions' => get_loaded_extensions(),
    'included' => get_included_files(),
    'classFiles' => array_keys($files),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
