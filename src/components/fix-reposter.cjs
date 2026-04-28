$content = Get-Content ReposterPage.tsx -Raw

# Add default values for missing fields in RuleCard component
# Find the line with "const targets = accounts.filter" and add defaults after it
$fix = @"
  const ruleWithDefaults = {
    source: { type: 'rss', name: '', url: '', ...rule.source },
    schedule: { days: [], hours: [], intervalMin: 0, intervalMax: 0, ...rule.schedule },
    filters: { minLength: 0, maxLength: 0, requireImage: false, stopWords: [], ...rule.filters },
    targetAccountIds: [],
    ...rule
  };
"@

$content = $content -replace '(\s+const targets = accounts\.filter.*)', "`n$fix`n`$1"

# Replace all rule. references with ruleWithDefaults. in the component
$content = $content -replace 'rule\.source\.', 'ruleWithDefaults.source.'
$content = $content -replace 'rule\.schedule\.', 'ruleWithDefaults.schedule.'
$content = $content -replace 'rule\.filters\.', 'ruleWithDefaults.filters.'

Set-Content ReposterPage.tsx -Value $content -NoNewline
Write-Host "Added default value guards"
