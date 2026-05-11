# ============================================================
# TRIGON blocks creation script (self-contained)
# ============================================================

$headers   = @{ "Authorization"="Bearer $env:WEBFLOW_TOKEN"; "Content-Type"="application/json" }
$colId     = "69627f22dbcb1b46df67cc39"
$worksColId= "6945b362af0e0a626834b87c"
$plId      = "691b7aef051d0e1c2b5fb919"
$enId      = "69a6d11e0d25be1a3132d39f"
$siteId    = "68f1195e1248336ba003654d"
$layout6_6 = "d0f481662c695ded1db2fe82dfcd8764"
$layout12  = "7b5ff27d0aea334d02201550fe5c5fea"
$layout4_8 = "9a894687f69835d22fa440b5bc7ed04a"
$typeImg1  = "bbb15d7c51e492078df63eb6c0d9b1f7"
$typeTxt1  = "1c76f4a04c5d4c5f7783990c8615e9dd"
$typeImg2  = "bd065bc2212a73c52076ee5cf603a110"
$typeTxt2  = "e3ad2a81ef5322787a7524d00b2d005e"

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
function Create-Block { param([hashtable]$fd)
    $body  = @{fieldData=$fd; cmsLocaleIds=@($plId,$enId); isDraft=$false; isArchived=$false} | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $res   = Invoke-RestMethod -Uri "https://api.webflow.com/beta/collections/$colId/items/bulk" -Method POST -Headers $headers -Body $bytes -ContentType "application/json; charset=utf-8"
    return $res.items[0].id
}

# Load asset lookup
Write-Host "Loading assets..."
$assetLookup = @{}; $off = 0
do {
    $res = Invoke-RestMethod -Uri "https://api.webflow.com/v2/sites/$siteId/assets?limit=100&offset=$off" -Headers $headers
    foreach ($a in $res.assets) { $assetLookup["$($a.displayName)_$($a.size)"] = $a }
    $off += $res.assets.Count
} while ($off -lt $res.pagination.total)
Write-Host "Assets loaded: $($assetLookup.Count)"

function Get-ImgRef { param([hashtable]$sizes, [string]$fname, [string]$alt)
    $a = $assetLookup["${fname}_$($sizes[$fname])"]
    if (-not $a) { Write-Warning "Missing asset: $fname"; return $null }
    return @{fileId=$a.id; url=$a.hostedUrl; alt=$alt}
}

$trigonSizes = @{
    "3-6-l.jpg"=457413; "3-6-r.jpg"=96204; "4-12.jpg"=269945; "5-12.jpg"=2874628
    "6-12.jpg"=2930470; "7-6-l.jpg"=1372788; "7-6-r.jpg"=994156; "8-12.jpg"=3378413
    "9-12.jpg"=742243; "11-12.jpg"=1538822; "12-12.jpg"=1592203; "13-12.jpg"=2277518
    "14-6-l.jpg"=849861; "14-6-r.jpg"=1351962; "16-12.jpg"=293377
    "mv-horizontal.jpg"=2810944; "mv-square.jpg"=1400221
}

Write-Host "=== Creating TRIGON blocks ==="
$ids = @{}

# ----- TRIGON-2 (4/8 text) -----
$ids["2"] = Create-Block @{
    "name" = "TRIGON-2"
    "layout" = $layout4_8
    "1---type-of-block" = $typeTxt1
    "2---type-of-block" = $typeTxt2
}
Write-Host "TRIGON-2: $($ids['2'])"

# ----- TRIGON-3 (6/6 img) -----
$i1 = Get-ImgRef $trigonSizes "3-6-l.jpg" "TRIGON 3-6-l"
$i2 = Get-ImgRef $trigonSizes "3-6-r.jpg" "TRIGON 3-6-r"
$ids["3"] = Create-Block @{
    "name" = "TRIGON-3"
    "layout" = $layout6_6
    "1---type-of-block" = $typeImg1
    "2---type-of-block" = $typeImg2
    "1-image" = $i1
    "2-image" = $i2
}
Write-Host "TRIGON-3: $($ids['3'])"

# ----- TRIGON-4 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "4-12.jpg" "TRIGON 4-12"
$ids["4"] = Create-Block @{
    "name" = "TRIGON-4"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-4: $($ids['4'])"

# ----- TRIGON-5 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "5-12.jpg" "TRIGON 5-12"
$ids["5"] = Create-Block @{
    "name" = "TRIGON-5"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-5: $($ids['5'])"

# ----- TRIGON-6 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "6-12.jpg" "TRIGON 6-12"
$ids["6"] = Create-Block @{
    "name" = "TRIGON-6"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-6: $($ids['6'])"

# ----- TRIGON-7 (6/6 img) -----
$i1 = Get-ImgRef $trigonSizes "7-6-l.jpg" "TRIGON 7-6-l"
$i2 = Get-ImgRef $trigonSizes "7-6-r.jpg" "TRIGON 7-6-r"
$ids["7"] = Create-Block @{
    "name" = "TRIGON-7"
    "layout" = $layout6_6
    "1---type-of-block" = $typeImg1
    "2---type-of-block" = $typeImg2
    "1-image" = $i1
    "2-image" = $i2
}
Write-Host "TRIGON-7: $($ids['7'])"

# ----- TRIGON-8 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "8-12.jpg" "TRIGON 8-12"
$ids["8"] = Create-Block @{
    "name" = "TRIGON-8"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-8: $($ids['8'])"

# ----- TRIGON-9 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "9-12.jpg" "TRIGON 9-12"
$ids["9"] = Create-Block @{
    "name" = "TRIGON-9"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-9: $($ids['9'])"

# ----- TRIGON-10 (4/8 text, right-only) -----
$ids["10"] = Create-Block @{
    "name" = "TRIGON-10"
    "layout" = $layout4_8
    "2---type-of-block" = $typeTxt2
}
Write-Host "TRIGON-10: $($ids['10'])"

# ----- TRIGON-11 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "11-12.jpg" "TRIGON 11-12"
$ids["11"] = Create-Block @{
    "name" = "TRIGON-11"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-11: $($ids['11'])"

# ----- TRIGON-12 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "12-12.jpg" "TRIGON 12-12"
$ids["12"] = Create-Block @{
    "name" = "TRIGON-12"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-12: $($ids['12'])"

# ----- TRIGON-13 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "13-12.jpg" "TRIGON 13-12"
$ids["13"] = Create-Block @{
    "name" = "TRIGON-13"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-13: $($ids['13'])"

# ----- TRIGON-14 (6/6 img) -----
$i1 = Get-ImgRef $trigonSizes "14-6-l.jpg" "TRIGON 14-6-l"
$i2 = Get-ImgRef $trigonSizes "14-6-r.jpg" "TRIGON 14-6-r"
$ids["14"] = Create-Block @{
    "name" = "TRIGON-14"
    "layout" = $layout6_6
    "1---type-of-block" = $typeImg1
    "2---type-of-block" = $typeImg2
    "1-image" = $i1
    "2-image" = $i2
}
Write-Host "TRIGON-14: $($ids['14'])"

# ----- TRIGON-15 (4/8 text, right-only) -----
$ids["15"] = Create-Block @{
    "name" = "TRIGON-15"
    "layout" = $layout4_8
    "2---type-of-block" = $typeTxt2
}
Write-Host "TRIGON-15: $($ids['15'])"

# ----- TRIGON-16 (12 img) -----
$i1 = Get-ImgRef $trigonSizes "16-12.jpg" "TRIGON 16-12"
$ids["16"] = Create-Block @{
    "name" = "TRIGON-16"
    "layout" = $layout12
    "1---type-of-block" = $typeImg1
    "1-image" = $i1
}
Write-Host "TRIGON-16: $($ids['16'])"

Write-Host ""
Write-Host "=== All 15 blocks created ==="
foreach ($k in ($ids.Keys | Sort-Object)) { Write-Host "TRIGON-$k = $($ids[$k])" }

# Export IDs for next script
$global:trigonBlockIds = $ids
