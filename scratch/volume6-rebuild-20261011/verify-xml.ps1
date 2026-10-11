$vol6Root = Join-Path (Get-Location) '第六卷-世界书整理'
$vol6Records = @()
foreach ($vol6Category in @('人物条目','场景条目','设定条目')) {
  foreach ($vol6File in Get-ChildItem -LiteralPath (Join-Path $vol6Root $vol6Category) -File -Filter '*.md') {
    $vol6Text = [System.IO.File]::ReadAllText($vol6File.FullName, [System.Text.UTF8Encoding]::new($false,$true))
    $vol6Matches = [regex]::Matches($vol6Text,'(?s)```xml\s*\r?\n(.*?)\r?\n```')
    foreach ($vol6Match in $vol6Matches) {
      $vol6Ok = $true
      $vol6Message = ''
      try {
        $vol6Xml = [System.Xml.XmlDocument]::new()
        $vol6Xml.XmlResolver = $null
        $vol6Xml.LoadXml($vol6Match.Groups[1].Value)
        if ($vol6Category -eq '场景条目') {
          $vol6Headers = [regex]::Matches($vol6Match.Groups[1].Value,'【[^】]+】')
          $vol6Children = @($vol6Xml.DocumentElement.ChildNodes | Where-Object NodeType -eq 'Element')
          if ($vol6Headers.Count -ne 6 -and $vol6Children.Count -ne 6) { throw 'Scene must have six sections' }
        }
      } catch {
        $vol6Ok = $false
        $vol6Message = $_.Exception.Message
      }
      $vol6Records += [pscustomobject]@{path=($vol6Category+'/'+$vol6File.Name);ok=$vol6Ok;message=$vol6Message}
    }
  }
}
$vol6Records | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'scratch/volume6-rebuild-20261011/xml-audit.json' -Encoding utf8
$vol6Records | Where-Object { -not $_.ok } | ConvertTo-Json
Write-Output ('XML blocks checked: ' + $vol6Records.Count)
if (@($vol6Records | Where-Object { -not $_.ok }).Count -gt 0) { exit 1 }
