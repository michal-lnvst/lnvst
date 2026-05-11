# ============================================================
# TRIGON text patching script (self-contained)
# Patches: TRIGON-2, TRIGON-10, TRIGON-15
# ============================================================

$headers = @{ "Authorization"="Bearer $env:WEBFLOW_TOKEN"; "Content-Type"="application/json" }
$colId   = "69627f22dbcb1b46df67cc39"
$plId    = "691b7aef051d0e1c2b5fb919"
$enId    = "69a6d11e0d25be1a3132d39f"
$base    = "C:\Users\wituc\OneDrive\Dokumenty\GitHub\lnvst\imports\works"

function Escape-Html { param([string]$s); $s.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;') }
function To-Html { param([string[]]$lines, [bool]$firstIsH3=$false)
    if (!$lines -or $lines.Count -eq 0) { return "" }
    $html = ""; $first = $true
    foreach ($l in $lines) {
        if ([string]::IsNullOrWhiteSpace($l)) { continue }
        $esc = (Escape-Html $l)
        if ($firstIsH3 -and $first) { $html += "<h3>$esc</h3>" } else { $html += "<p>$esc</p>" }
        $first = $false
    }
    return $html
}

function Patch-TextBlock {
    param([string]$blockId, [string]$plHtml1, [string]$plHtml2, [string]$plHtmlAdd,
          [string]$enHtml1, [string]$enHtml2, [string]$enHtmlAdd)
    $plBody  = @{items=@(@{id=$blockId;cmsLocaleId=$plId;fieldData=@{"1-text"=$plHtml1;"2-text"=$plHtml2;"right-additional-text"=$plHtmlAdd}})} | ConvertTo-Json -Depth 10 -Compress
    $plBytes = [System.Text.Encoding]::UTF8.GetBytes($plBody)
    Invoke-RestMethod -Uri "https://api.webflow.com/v2/collections/$colId/items" -Method PATCH -Headers $headers -Body $plBytes -ContentType "application/json; charset=utf-8" | Out-Null
    $enBody  = @{items=@(@{id=$blockId;cmsLocaleId=$enId;fieldData=@{"1-text"=$enHtml1;"2-text"=$enHtml2;"right-additional-text"=$enHtmlAdd}})} | ConvertTo-Json -Depth 10 -Compress
    $enBytes = [System.Text.Encoding]::UTF8.GetBytes($enBody)
    Invoke-RestMethod -Uri "https://api.webflow.com/v2/collections/$colId/items" -Method PATCH -Headers $headers -Body $enBytes -ContentType "application/json; charset=utf-8" | Out-Null
    Write-Host "Patched $blockId"
}

function Parse-OldTextFile { param([string]$filePath)
    $sections = @{}; $currentKey = $null
    $plLines  = [System.Collections.Generic.List[string]]::new()
    $enLines  = [System.Collections.Generic.List[string]]::new()
    $stop     = @("Services:","Theme:","Project team:","Client:")
    foreach ($line in (Get-Content $filePath -Encoding UTF8)) {
        if ($line -match '^\d+-\d+-[lrLR](-a)?$') {
            if ($currentKey) { $sections[$currentKey] = @{pl=$plLines.ToArray();en=$enLines.ToArray()} }
            $currentKey = $line.Trim()
            $plLines = [System.Collections.Generic.List[string]]::new()
            $enLines = [System.Collections.Generic.List[string]]::new()
        } elseif ($currentKey) {
            $t = $line.Trim(); if ($t -eq '') { continue }
            if ($stop | Where-Object { $t.StartsWith($_) }) { continue }
            if ($t.StartsWith('/')) { $enLines.Add($t.TrimStart('/').Trim()) } else { $plLines.Add($t) }
        }
    }
    if ($currentKey) { $sections[$currentKey] = @{pl=$plLines.ToArray();en=$enLines.ToArray()} }
    return $sections
}

$sec = Parse-OldTextFile "$base\TRIGON\trigon.txt"

# ---- Block IDs ----
$id2  = "69e00fd7b1419a02e745467d"
$id10 = "69e00fdfb1419a02e7454a46"
$id15 = "69e00fe4b9e0698de169c5c0"

# ============================================================
# TRIGON-2 (4/8 text: 2-4-l left, 2-8-r right, 2-8-r-a right-add)
# ============================================================

# PL 1-text (2-4-l): single line "Podsumowanie"
$pl1 = To-Html $sec['2-4-l'].pl $false

# PL 2-text (2-8-r): use pl[0..2] only (pl[3] is a misplaced EN line)
$pl2 = To-Html $sec['2-8-r'].pl[0..2] $true

# PL right-additional-text (2-8-r-a): use pl[0..9] (first 10 are PL)
$plAdd = To-Html $sec['2-8-r-a'].pl[0..9] $false

# EN 1-text (2-4-l)
$en1 = To-Html $sec['2-4-l'].en $false

# EN 2-text (2-8-r):
# en[0] = "When the experience goes beyond (the expectations).At first glance..."
# Need to split: h3 is "When the experience goes beyond (the expectations)."
# Then paragraph is rest of en[0] + pl[3] (which was misplaced EN)
$enTitle = "When the experience goes beyond (the expectations)."
$enRaw   = $sec['2-8-r'].en[0]
$enP1    = $enRaw.Substring($enTitle.Length).Trim()
$enP2    = $sec['2-8-r'].pl[3]
$en2     = "<h3>$(Escape-Html $enTitle)</h3><p>$(Escape-Html $enP1)</p><p>$(Escape-Html $enP2)</p>"

# EN right-additional-text (2-8-r-a):
# en[0] = first EN paragraph (/ prefix in file)
# pl[10..18] = remaining 9 EN lines that lacked / prefix
$enAddLines = @($sec['2-8-r-a'].en[0]) + $sec['2-8-r-a'].pl[10..18]
$enAdd = To-Html $enAddLines $false

Write-Host "Patching TRIGON-2..."
Patch-TextBlock $id2 $pl1 $pl2 $plAdd $en1 $en2 $enAdd

# ============================================================
# TRIGON-10 (right-only text: 10-8-r, 2-text field only)
# ============================================================
$pl2_10 = To-Html $sec['10-8-r'].pl $true
$en2_10 = To-Html $sec['10-8-r'].en $true
Patch-TextBlock $id10 "" $pl2_10 "" "" $en2_10 ""

# ============================================================
# TRIGON-15 (right-only text: 15-8-r, 2-text field only)
# ============================================================
$pl2_15 = To-Html $sec['15-8-r'].pl $true
$en2_15 = To-Html $sec['15-8-r'].en $true
Patch-TextBlock $id15 "" $pl2_15 "" "" $en2_15 ""

Write-Host ""
Write-Host "=== All text blocks patched ==="
