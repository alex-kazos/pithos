# Create the platforms directory if it doesn't exist
$platformsDir = "public/images/platforms"
if (-not (Test-Path $platformsDir)) {
    New-Item -ItemType Directory -Path $platformsDir -Force
}

# Logo URLs
$logos = @{
    "shopify" = "https://cdn.worldvectorlogo.com/logos/shopify.svg"
    "open-ai" = "https://cdn.worldvectorlogo.com/logos/openai.svg"
    "woocommerce" = "https://cdn.worldvectorlogo.com/logos/woocommerce.svg"
    "bigcommerce" = "https://cdn.worldvectorlogo.com/logos/bigcommerce-1.svg"
}

# Download each logo
foreach ($logo in $logos.GetEnumerator()) {
    $outputPath = Join-Path $platformsDir "$($logo.Key).svg"
    Write-Host "Downloading $($logo.Key) logo to $outputPath"
    Invoke-WebRequest -Uri $logo.Value -OutFile $outputPath
} 