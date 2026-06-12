Dim shell, fso, currentDir, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取当前 VBS 脚本所在的绝对路径
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 拼接命令，先 cd 进入项目文件夹，再执行 npm start
' 这里的 0 代表隐藏命令窗口，不会出现命令行黑框
cmd = "cmd.exe /c cd /d """ & currentDir & """ && npm start"
shell.Run cmd, 0, false
