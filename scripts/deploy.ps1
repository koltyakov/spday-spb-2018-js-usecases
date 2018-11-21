$ConfigPath = "$PSScriptRoot\..\config\private.json";
$SchemaPath = "$PSScriptRoot\template.xml";

$Context = Get-Content $ConfigPath -Encoding UTF8 | ConvertFrom-Json;

$Connection = Connect-PnPOnline -Url $Context.siteUrl -ReturnConnection;

Apply-PnPProvisioningTemplate `
  -Path $SchemaPath `
  -Connection $Connection;
