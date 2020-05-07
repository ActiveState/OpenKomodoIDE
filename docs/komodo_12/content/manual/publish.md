---
title: Publishing
---
(Komodo IDE only)

Publishing synchronizes groups of files between local and remote file systems over FTP, SFTP, FTPS, or SCP. You can upload a group of files from your local system or download a group from the remote system and keep them synchronized. Local changes are pushed to the remote server, and remote changes are pulled to the local system.

Komodo keeps track of the synchronization details to avoid copying files that haven't changed and uses advanced conflict detection to avoid overwriting changes made by others.

You can use Publishing for deploying websites to the hosting web server, or use it with remote storage as a simple backup utility.

![Publishing](/images/publishing.png)

<a name="publish_config" id="publish_config"></a>
## Creating a Configuration

1. Select **Tools** > **Publishing** > **New Configuration** to launch the Publishing configuration wizard.
1. Enter the following settings and options:

  - **Name**: A convenient name for your saved configuration.
  - **Local path**: The full path to the local directory. Use the **Browse** button or enter the path manually.
  - **Remote path**: The URI of the remote directory, including the hostname and full path. Use the **Browse** button to navigate to a [previously configured server](prefs.html#Servers), or enter the URI manually (e.g. `scp://username@servername/path/to/dir`)
  - **Includes**: File types to be included in the synchronization. Use glob syntax separated by semi-colons (e.g. "*;*.xml") or leave blank.
  - **Excludes**: File types to be excluded from the synchronization. Same syntax as above. If you use both, the Excludes list takes priority if there are conflicts.
  - **When a file is saved locally, auto-push it to the remote server**: Select this option to ensure that when a local publishing file is saved in the Komodo editor, it will be automatically pushed to the remote server location.

1. Click **Save**. The Synchronization dialog box opens and shows the details of the pending synchronization.

<a name="publish_sync" id="publish_sync"></a>
## Synchronizing

The Synchronization dialog box shows:

- Local files and folders that will be uploaded to the server.
- Remote files and folders that will be downloaded from the server.
- Any files that cannot be synchronized because of a conflict.

![Synchronization dialog box](/images/publish_sync.png)

When synchronizing, Komodo will examine the local and remote locations for any file differences and present the changes for your inspection. Check the files you wish to be transferred.

The following actions are available:

- **Check All/None**: Selecting the checkbox at the top of the Sync column selects all of the items in the list.
- **Force Push All**: If Komodo is going to "download" a deleted or edited file or folder and you don't want it to, you can force it to upload the local state instead with this option.
- **Force Pull All**: The opposite action of Force Push All. Force download if you wish your local files to reflect the remote files but Komodo is suggesting the opposite.
- **Synchronize**: Synchronizes the files in the local and remote directories.

<a name="publish_commands" id="publish_commands"></a>
## Publishing commands for individual files

There are also the following publishing commands available on a per-file basis (through the Places or the editor tab context menus):

- **Push**: Uploads the locally changed file(s) to the remote server.
- **Force Push**: **This overwrites the remote file even if there are changes
    there**. If there is a conflict this command allows you to force push the
    file without opening the Publishing dialog.
- **Pull**: Copies the remote changed file(s) locally.
- **Force Pull**: **This overwrites the local file even if there are changes
    there**. If there is a conflict this command allows you to force pull the
    file without opening the Publishing dialog.
- **Diff**: Shows the line-by-line differences between the local and remote file.
