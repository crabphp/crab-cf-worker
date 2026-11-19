#!/bin/sh
# Packs the application into dist/app.zip, which the Worker carries and unpacks into PHP's filesystem.
set -eu
cd "$(dirname "$0")/.."

composer install --no-dev --optimize-autoloader --quiet

# The PHP this Worker runs is 32-bit, so its integers stop at 2,147,483,647. The framework's
# Validator bounds whole numbers at 2^53 - 1, which does not fit and stops the class from loading.
# Until the framework allows for 32-bit PHP, the bundled copy caps that bound at PHP_INT_MAX.
validator=vendor/crabphp/framework/src/Validation/Validator.php
sed 's/private const int SAFE = 9_007_199_254_740_991;/private const int SAFE = PHP_INT_SIZE >= 8 ? 9_007_199_254_740_991 : PHP_INT_MAX;/' \
    "$validator" > "$validator.tmp" && mv "$validator.tmp" "$validator"
grep -q 'PHP_INT_SIZE >= 8' "$validator" || { echo "The Validator patch no longer applies: check $validator." >&2; exit 1; }

mkdir -p dist
rm -f dist/app.zip
zip -r -q -X dist/app.zip app app.php worker.php config resources routes vendor \
    -x 'vendor/*/tests/*' 'vendor/*/docs/*' 'vendor/*/examples/*' 'vendor/*/.claude/*' 'vendor/*/.github/*' '*.md'
echo "dist/app.zip: $(du -h dist/app.zip | cut -f1), $(unzip -Z1 dist/app.zip | grep -c '\.php$') PHP files"
