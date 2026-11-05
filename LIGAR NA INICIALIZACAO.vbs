' Atalho da pasta Inicializar: liga o escritório escondido quando o Windows
' entra (sem desligar se já estiver no ar e sem abrir o navegador).
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & pasta & "\LIGAR-DESLIGAR ESCRITORIO.ps1"" -SoLigar", 0, False
