$token = $env:WEBFLOW_TOKEN
$blocksId = '69627f22dbcb1b46df67cc39'
$plLocale = '691b7aef051d0e1c2b5fb919'
$enLocale = '69a6d11e0d25be1a3132d39f'

function Get-AllItems {
    param($collectionId, $locale = $null)
    $items = @()
    $offset = 0
    do {
        $url = "https://api.webflow.com/v2/collections/$collectionId/items?limit=100&offset=$offset"
        if ($locale) { $url += "&locale=$locale" }
        $resp = Invoke-WebRequest -Uri $url -Headers @{'Authorization' = "Bearer $token"} -ContentType 'application/json' -UseBasicParsing
        $data = $resp.Content | ConvertFrom-Json
        $items += $data.items
        $offset += 100
    } while ($data.items.Count -eq 100)
    return $items
}

function Split-LocalizedText {
    param($text)
    if ($text -notmatch '/') {
        return @{ PL = $text; EN = $null }
    }
    
    # Split on first "/" that's not part of escaped content
    $parts = $text -split '(?<=/\n|\n/)(?=/)', 2
    if ($parts.Count -eq 2) {
        $plText = $parts[0].TrimEnd()
        $enText = $parts[1].TrimStart().Substring(1).TrimStart()  # Remove the leading '/'
        return @{ PL = $plText; EN = $enText }
    }
    
    # Fallback: simple split
    $idx = $text.IndexOf('/')
    if ($idx -gt 0) {
        $plText = $text.Substring(0, $idx).TrimEnd()
        $enText = $text.Substring($idx + 1).TrimStart()
        return @{ PL = $plText; EN = $enText }
    }
    
    return @{ PL = $text; EN = $null }
}

Write-Host "Fetching all blocks in PL locale..."
$allBlocksPL = Get-AllItems -collectionId $blocksId -locale $plLocale

Write-Host "Fetching all blocks in EN locale..."
$allBlocksEN = Get-AllItems -collectionId $blocksId -locale $enLocale

Write-Host "Analyzing blocks with '/' separator..."
$blocksToFix = @()
$blockMap = @{}
foreach ($block in $allBlocksPL) {
    $blockMap[$block.id] = $block
    $needsUpdate = $false
    foreach ($field in @('1-text', '2-text', 'right-additional-text')) {
        if ($block.fieldData.$field -and $block.fieldData.$field -match '/') {
            $needsUpdate = $true
            break
        }
    }
    if ($needsUpdate) {
        $blocksToFix += $block
    }
}

Write-Host "Found $($blocksToFix.Count) blocks with '/' separator to fix"
if ($blocksToFix.Count -eq 0) {
    Write-Host "No blocks need updating."
    exit 0
}

# Build update batch
$updates = @()
foreach ($plBlock in $blocksToFix) {
    # Find EN locale version
    $enBlock = $allBlocksEN | Where-Object { $_.id -eq $plBlock.id }
    if (-not $enBlock) {
        Write-Host "WARNING: No EN locale version found for block $($plBlock.fieldData.name) (ID: $($plBlock.id))"
        continue
    }
    
    # Process each text field
    foreach ($field in @('1-text', '2-text', 'right-additional-text')) {
        $plText = $plBlock.fieldData.$field
        $enText = $enBlock.fieldData.$field
        
        if ($plText -and $plText -match '/') {
            $split = Split-LocalizedText -text $plText
            
            # Create PL update
            if ($split.PL -ne $plText) {
                $updates += @{
                    id = $plBlock.id
                    locale = $plLocale
                    field = $field
                    value = $split.PL
                    blockName = $plBlock.fieldData.name
                }
                Write-Host "SPLIT|PL|$($plBlock.fieldData.name)|$field"
            }
            
            # Create EN update
            if ($split.EN) {
                $updates += @{
                    id = $plBlock.id
                    locale = $enLocale
                    field = $field
                    value = $split.EN
                    blockName = $plBlock.fieldData.name
                }
                Write-Host "SPLIT|EN|$($plBlock.fieldData.name)|$field"
            }
        }
    }
}

Write-Host ""
Write-Host "Total updates to apply: $($updates.Count)"

# Apply updates in batches (max 10 per batch for API limits)
$batchSize = 10
for ($i = 0; $i -lt $updates.Count; $i += $batchSize) {
    $batch = $updates[$i..([Math]::Min($i + $batchSize - 1, $updates.Count - 1))]
    
    foreach ($update in $batch) {
        $url = "https://api.webflow.com/v2/collections/$blocksId/items/$($update.id)?locale=$($update.locale)"
        
        # Get current item to preserve other fields
        $resp = Invoke-WebRequest -Uri $url -Headers @{'Authorization' = "Bearer $token"} -ContentType 'application/json' -UseBasicParsing
        $item = $resp.Content | ConvertFrom-Json
        
        # Update the field
        $item.fieldData.$($update.field) = $update.value
        
        # Patch the item with depth=40 for nested JSON
        $body = $item | ConvertTo-Json -Depth 40
        $patchResp = Invoke-WebRequest -Uri $url -Method PATCH -Headers @{'Authorization' = "Bearer $token"} -ContentType 'application/json' -Body $body -UseBasicParsing
        
        Write-Host "UPDATED|$($update.blockName)|$($update.field)|$($update.locale)"
    }
}

Write-Host ""
Write-Host "Block text entries updated successfully!"
