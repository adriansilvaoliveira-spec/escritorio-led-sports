' Roda o LIGAR-DESLIGAR ESCRITORIO.ps1 sem piscar nenhuma janela.
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & pasta & "\LIGAR-DESLIGAR ESCRITORIO.ps1""", 0, False
