# ====================================================================
# complete-cms.ps1  –  Complete CMS block creation for 8 projects
# ====================================================================

Set-StrictMode -Off

# ── IDs / constants ──────────────────────────────────────────────────
$headers    = @{ "Authorization" = "Bearer $env:WEBFLOW_TOKEN"; "Content-Type" = "application/json" }
$colId      = "69627f22dbcb1b46df67cc39"   # Works Blocks
$worksColId = "6945b362af0e0a626834b87c"   # Works
$siteId     = "68f1195e1248336ba003654d"
$plId       = "691b7aef051d0e1c2b5fb919"
$enId       = "69a6d11e0d25be1a3132d39f"
$base       = "C:\Users\wituc\OneDrive\Dokumenty\GitHub\lnvst\imports\works"

$layout6_6   = "d0f481662c695ded1db2fe82dfcd8764"
$layout12    = "7b5ff27d0aea334d02201550fe5c5fea"
$layout4_8   = "9a894687f69835d22fa440b5bc7ed04a"
$layout8_4   = "58888fcc29f6f346ecf9db3624338b37"
$typeImg1    = "bbb15d7c51e492078df63eb6c0d9b1f7"
$typeTxt1    = "1c76f4a04c5d4c5f7783990c8615e9dd"
$typeImg2    = "bd065bc2212a73c52076ee5cf603a110"
$typeTxt2    = "e3ad2a81ef5322787a7524d00b2d005e"

# ── Project config ───────────────────────────────────────────────────
$projects = @(
    @{ folder="BDI";                         plFile="bdi.txt";         enFile="bdi-en.txt";         prefix="BDI";       worksId="69df9f133119cb8f89b5cd1e" }
    @{ folder="Anna Krzanicka-Bombczyńska";  plFile="AKB.txt";         enFile="AKB-en.txt";         prefix="AKB";       worksId="69df9f12a24e44f252a7c20c" }
    @{ folder="more";                        plFile="more.txt";        enFile="more-en.txt";         prefix="more";      worksId="69df9f14dda234e9fb418d99" }
    @{ folder="oe";                          plFile="oe.txt";          enFile="oe-en.txt";           prefix="oe";        worksId="69df9f15067e069b3306163e" }
    @{ folder="InvestGDA";                   plFile="investgda.txt";   enFile="investgda-en.txt";    prefix="InvestGDA"; worksId="69df9f11ff8c5c893f68e3bc" }
    @{ folder="Lambda";                      plFile="lambda.txt";      enFile="lambda-en.txt";       prefix="Lambda";    worksId="69df9f0fdda234e9fb4189d6" }
    @{ folder="Fabra";                       plFile="fabra.txt";       enFile="fabra-en.txt";        prefix="Fabra";     worksId="69df9f17dda234e9fb41901e" }
    @{ folder="Katana";                      plFile="katana.txt";      enFile="katana-en.txt";       prefix="Katana";    worksId="6945b4d8601480e3662c9244" }
)

# ====================================================================
# STEP 1 – Fetch all Webflow assets, build lookup by "displayName_size"
# ====================================================================
Write-Host "`n=== Fetching Webflow assets ===" -ForegroundColor Cyan
$allAssets = @()
$offset = 0
do {
    $res = Invoke-RestMethod -Uri "https://api.webflow.com/v2/sites/$siteId/assets?limit=100&offset=$offset" -Headers $headers
    $allAssets += $res.assets
    $offset += $res.assets.Count
} while ($allAssets.Count -lt $res.pagination.total)

$assetLookup = @{}
foreach ($a in $allAssets) {
    $key = "$($a.displayName)_$($a.size)"
    if (-not $assetLookup.ContainsKey($key) -or ([datetime]$a.createdOn -gt [datetime]$assetLookup[$key].createdOn)) {
        $assetLookup[$key] = $a
    }
}
Write-Host "Loaded $($allAssets.Count) assets → $($assetLookup.Count) unique (by name+size)"

# ====================================================================
# STEP 2 – Build per-project asset maps
# ====================================================================
function Build-ProjAssets {
    param([string]$folderPath)
    $map = @{}
    Get-ChildItem -Path $folderPath -Filter "*.jpg" | Where-Object { $_.Name -notlike "mv-*.jpg" } | ForEach-Object {
        $key = "$($_.Name)_$($_.Length)"
        if ($assetLookup.ContainsKey($key)) {
            $map[$_.Name] = @{ id = $assetLookup[$key].id; url = $assetLookup[$key].hostedUrl }
        } else {
            Write-Warning "No asset match: $($_.Name) size=$($_.Length) in $folderPath"
        }
    }
    return $map
}

$projAssets = @{}
foreach ($p in $projects) {
    $projAssets[$p.prefix] = Build-ProjAssets "$base\$($p.folder)"
}
Write-Host "Asset maps built for: $($projAssets.Keys -join ', ')"

# ====================================================================
# STEP 3 – HTML helpers
# ====================================================================
function Escape-Html { param([string]$s); $s.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;') }

function Lines-To-Html {
    param([string[]]$lines, [bool]$firstIsH3 = $false)
    $html = ""
    $first = $true
    foreach ($line in $lines) {
        $line = $line.TrimStart('/').Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $esc = Escape-Html $line
        if ($firstIsH3 -and $first) {
            $html += "<h3>$esc</h3>"
        } else {
            $html += "<p>$esc</p>"
        }
        $first = $false
    }
    return $html
}

# ====================================================================
# STEP 4 – Parse text file into sections keyed by "N-W-side[-a]"
# ====================================================================
function Parse-TextFile {
    param([string]$filePath)
    $sections = @{}
    $currentKey = $null
    $currentLines = [System.Collections.Generic.List[string]]::new()

    foreach ($line in (Get-Content $filePath -Encoding UTF8)) {
        if ($line -match '^\d+-\d+-[lrLR](-a)?$') {
            if ($currentKey) { $sections[$currentKey] = $currentLines.ToArray() }
            $currentKey = $line.Trim()
            $currentLines = [System.Collections.Generic.List[string]]::new()
        } elseif ($currentKey -and $line.Trim() -ne '') {
            $currentLines.Add($line.TrimStart('/').Trim())
        }
    }
    if ($currentKey) { $sections[$currentKey] = $currentLines.ToArray() }
    return $sections
}

# ====================================================================
# STEP 5 – Build ordered block definitions for a project
# ====================================================================
function Get-BlockDefs {
    param([hashtable]$proj)

    $prefix = $proj.prefix
    $folderPath = "$base\$($proj.folder)"
    $assetMap = $projAssets[$prefix]

    $plSec = Parse-TextFile "$folderPath\$($proj.plFile)"
    $enSec = Parse-TextFile "$folderPath\$($proj.enFile)"

    # Build image row map: row → {12, l, r} file names
    $imgRows = @{}
    Get-ChildItem -Path $folderPath -Filter "*.jpg" | Where-Object { $_.Name -notlike "mv-*.jpg" } | ForEach-Object {
        if ($_.Name -match '^(\d+)-12\.jpg$')    { [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["12"]=$_.Name }
        elseif ($_.Name -match '^(\d+)-6-l\.jpg$'){ [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["l"]=$_.Name  }
        elseif ($_.Name -match '^(\d+)-6-r\.jpg$'){ [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["r"]=$_.Name  }
        elseif ($_.Name -match '^(\d+)-8-l\.jpg$'){ [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["8l"]=$_.Name }
        elseif ($_.Name -match '^(\d+)-8-r\.jpg$'){ [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["8r"]=$_.Name }
        elseif ($_.Name -match '^(\d+)-4-l\.jpg$'){ [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["4l"]=$_.Name }
        elseif ($_.Name -match '^(\d+)-4-r\.jpg$'){ [int]$row=$Matches[1]; if(!$imgRows[$row]){$imgRows[$row]=@{}}; $imgRows[$row]["4r"]=$_.Name }
    }

    # Build text section lookup: row → sections dict
    $textRows = @{}
    foreach ($key in ($plSec.Keys + $enSec.Keys)) {
        if ($key -match '^(\d+)-') {
            [int]$row = $Matches[1]
            if (!$textRows[$row]) { $textRows[$row] = @{} }
        }
    }
    foreach ($key in $plSec.Keys) { if ($key -match '^(\d+)-') { [int]$row=$Matches[1]; $textRows[$row]["pl:$key"] = $plSec[$key] } }
    foreach ($key in $enSec.Keys) { if ($key -match '^(\d+)-') { [int]$row=$Matches[1]; $textRows[$row]["en:$key"] = $enSec[$key] } }

    $allRows = (@() + $imgRows.Keys + $textRows.Keys) | Select-Object -Unique | Sort-Object { [int]$_ }
    $blocks = @()

    foreach ($row in $allRows) {
        $blockName = "$prefix-$row"

        if ($imgRows[$row]) {
            $ir = $imgRows[$row]
            $fd = @{ "name" = $blockName }

            if ($ir["12"]) {
                $a = $assetMap[$ir["12"]]
                $fd["layout"] = $layout12
                $fd["1---type-of-block"] = $typeImg1
                $fd["1-image"] = @{ fileId=$a.id; url=$a.url }

            } elseif ($ir["l"] -or $ir["r"]) {
                $fd["layout"] = $layout6_6
                if ($ir["l"]) { $a=$assetMap[$ir["l"]]; $fd["1---type-of-block"]=$typeImg1; $fd["1-image"]=@{fileId=$a.id;url=$a.url} }
                if ($ir["r"]) { $a=$assetMap[$ir["r"]]; $fd["2---type-of-block"]=$typeImg2; $fd["2-image"]=@{fileId=$a.id;url=$a.url} }

            } elseif ($ir["8l"] -or $ir["4r"]) {
                $fd["layout"] = $layout8_4
                if ($ir["8l"]) { $a=$assetMap[$ir["8l"]]; $fd["1---type-of-block"]=$typeImg1; $fd["1-image"]=@{fileId=$a.id;url=$a.url} }
                if ($ir["4r"]) { $a=$assetMap[$ir["4r"]]; $fd["2---type-of-block"]=$typeImg2; $fd["2-image"]=@{fileId=$a.id;url=$a.url} }

            } elseif ($ir["4l"] -or $ir["8r"]) {
                $fd["layout"] = $layout4_8
                if ($ir["4l"]) { $a=$assetMap[$ir["4l"]]; $fd["1---type-of-block"]=$typeImg1; $fd["1-image"]=@{fileId=$a.id;url=$a.url} }
                if ($ir["8r"]) { $a=$assetMap[$ir["8r"]]; $fd["2---type-of-block"]=$typeImg2; $fd["2-image"]=@{fileId=$a.id;url=$a.url} }
            }

            $blocks += [PSCustomObject]@{ name=$blockName; type="image"; fieldData=$fd; enFieldData=@{} }

        } elseif ($textRows[$row]) {
            $tr = $textRows[$row]
            $fd = @{ "name" = $blockName; "layout" = $layout4_8 }
            $enFd = @{}

            # PL – find sections for this row
            $pl_l   = $tr.Keys | Where-Object { $_ -match "^pl:$row-\d+-l$" }
            $pl_r   = $tr.Keys | Where-Object { $_ -match "^pl:$row-\d+-r$" }
            $pl_ra  = $tr.Keys | Where-Object { $_ -match "^pl:$row-\d+-r-a$" }
            # EN
            $en_l   = $tr.Keys | Where-Object { $_ -match "^en:$row-\d+-l$" }
            $en_r   = $tr.Keys | Where-Object { $_ -match "^en:$row-\d+-r$" }
            $en_ra  = $tr.Keys | Where-Object { $_ -match "^en:$row-\d+-r-a$" }

            if ($pl_l)  { $fd["1---type-of-block"]=$typeTxt1; $fd["1-text"] = Lines-To-Html $tr[$pl_l[0]]  $false }
            if ($pl_r)  { $fd["2---type-of-block"]=$typeTxt2; $fd["2-text"] = Lines-To-Html $tr[$pl_r[0]]  $true  }
            if ($pl_ra) { $fd["right-additional-text"] = Lines-To-Html $tr[$pl_ra[0]] $false }

            if ($en_l)  { $enFd["1-text"]  = Lines-To-Html $tr[$en_l[0]]  $false }
            if ($en_r)  { $enFd["2-text"]  = Lines-To-Html $tr[$en_r[0]]  $true  }
            if ($en_ra) { $enFd["right-additional-text"] = Lines-To-Html $tr[$en_ra[0]] $false }

            $blocks += [PSCustomObject]@{ name=$blockName; type="text"; fieldData=$fd; enFieldData=$enFd }
        }
    }

    return $blocks
}

# ====================================================================
# STEP 6 – Fetch existing Works Blocks (all pages) to check what exists
# ====================================================================
Write-Host "`n=== Fetching existing Works Blocks ===" -ForegroundColor Cyan
$existingBlocks = @()
$offset = 0
do {
    $res = Invoke-RestMethod -Uri "https://api.webflow.com/v2/collections/$colId/items?limit=100&offset=$offset" -Headers $headers
    $existingBlocks += $res.items
    $offset += $res.items.Count
} while ($existingBlocks.Count -lt $res.pagination.total)

# Build name→id map for existing blocks
$existingByName = @{}
foreach ($item in $existingBlocks) {
    $existingByName[$item.fieldData.name] = $item.id
}
Write-Host "Found $($existingBlocks.Count) existing Works Blocks"

# ====================================================================
# STEP 7 – Create a single block (or reuse if exists)
# ====================================================================
function Create-Block {
    param([PSCustomObject]$blockDef)

    # If already exists, return existing ID
    if ($existingByName.ContainsKey($blockDef.name)) {
        Write-Host "  SKIP (exists) $($blockDef.name) → $($existingByName[$blockDef.name])"
        return $existingByName[$blockDef.name]
    }

    # Create via bulk beta endpoint (body is the item directly, not wrapped in items[])
    $body = @{
        fieldData    = $blockDef.fieldData
        cmsLocaleIds = @($plId, $enId)
        isDraft      = $false
        isArchived   = $false
    } | ConvertTo-Json -Depth 15

    $res = Invoke-RestMethod -Uri "https://api.webflow.com/beta/collections/$colId/items/bulk" `
        -Method POST -Headers $headers -Body $body
    $itemId = $res.items[0].id

    # Patch EN locale for text blocks
    if ($blockDef.type -eq "text" -and $blockDef.enFieldData.Count -gt 0) {
        $enBody = @{
            items = @(@{
                id          = $itemId
                cmsLocaleId = $enId
                fieldData   = $blockDef.enFieldData
            })
        } | ConvertTo-Json -Depth 15
        Invoke-RestMethod -Uri "https://api.webflow.com/v2/collections/$colId/items" `
            -Method PATCH -Headers $headers -Body $enBody | Out-Null
    }

    Write-Host "  CREATED $($blockDef.name) ($($blockDef.type)) → $itemId"
    return $itemId
}

# ====================================================================
# STEP 8 – Main loop: create all blocks for all projects
# (existingByName deduplicates – already-created blocks are reused)
# ====================================================================
Write-Host "`n=== Creating missing blocks ===" -ForegroundColor Cyan
$worksBlockIds = @{}

foreach ($p in $projects) {
    Write-Host "--- $($p.prefix) ---"
    $defs = Get-BlockDefs $p
    $ids = @()
    foreach ($def in $defs) {
        $id = Create-Block $def
        $ids += $id
    }
    $worksBlockIds[$p.prefix] = $ids
    Write-Host "  Total: $($ids.Count) blocks"
}

Write-Host "`n=== Block counts ===" -ForegroundColor Cyan
foreach ($k in $worksBlockIds.Keys | Sort-Object) {
    Write-Host "  $k`: $($worksBlockIds[$k].Count) blocks"
}

# ====================================================================
# STEP 9 – Update Works entries multireference field
# ====================================================================
Write-Host "`n=== Updating Works multireference fields ===" -ForegroundColor Cyan

foreach ($p in $projects) {
    $prefix  = $p.prefix
    $wId     = $p.worksId
    $ids     = $worksBlockIds[$prefix]

    if (-not $ids -or $ids.Count -eq 0) {
        Write-Host "  SKIP $prefix – no block IDs"
        continue
    }

    $body = @{ fieldData = @{ "works-blocks" = [string[]]$ids } } | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "https://api.webflow.com/v2/collections/$worksColId/items/$wId" `
        -Method PATCH -Headers $headers -Body $body | Out-Null
    Write-Host "  $prefix`: set $($ids.Count) blocks on Works entry $wId"
}

Write-Host "`nDone." -ForegroundColor Green


