---
title: Komodo collaboration
---
(Komodo IDE only)

## Account Setup

Before you can use Collaboration, you have to set up your ActiveState account in Komodo. If you do not have one, you can create one for free at: [https://account.activestate.com/signup/](https://account.activestate.com/signup/)

To set up the account, select **Tools** > **Komodo Services** > **My Account** from the menu. Enter the email address and password of your ActiveState account and click **Login**. If your login data was valid, you should see the message "You're logged in to Komodo Services".

## Collaboration Overview

With Collaboration you can edit documents in Komodo with several people at the same time. Changes are transmitted in near real-time, similar to other tools like Google Docs. All content that you create with Komodo Collaboration is stored on the ActiveState Collaboration server until you delete it. Though the Collaboration file content is not encrypted, all communication with the Collaboration Server is sent encrypted using HTTPS (HTTP over a Secure Socket Layer). Only your authorized Contacts will be able to see and edit your shared files.

### Using Collaboration

Open the **Collaboration** tab in the left sidebar and click the **Enable Komodo Collaboration** button.

When collaboration is enabled and connected to the server, the Collaboration tab on the left sidebar displays two different lists: **Sessions** and **Contacts**.

#### Sessions

A collaboration session is a collection of hosted documents that you can edit with other people. Click the plus icon in the top right corner of the Collaboration tab to create your first session. After you have given the session a name, it will appear in your Sessions list. New sessions are created without any documents.

To add a new document, right-click on the session name and select **Add** > **Empty Document** from the context menu. After you have given the document a name it appears under its session in the Sessions list. Double-click on the document to open it.

To share an existing file, open it in Komodo then right-click on the document tab and selecting **Collaboration** > **Share**.

#### Contacts

Contacts are other Komodo users that you can add to a collaboration session, giving them access to all documents within that session.

To add a contact, click the plus icon in the top right corner of the **Contacts** pane and enter their email address. Use an email address has been [registered with ActiveState](#collab_top). The contact will not appear in your list immediately; the new contact will receive a notification in the bottom right corner of their Komodo window that asks them to confirm you as their collaboration contact. Once they have confirmed you as their Contact they will appear in your Contacts list, and you can add them to your session by right clicking on the session name and selecting **Add** > **User to this Session** > **(Their name)**. Your session will then appear in their **Sessions** list and you can start editing documents together.

### Collaborative Editing

Editing text in a collaboration tab generally works the same as with any other document, but there are a couple of important differences.

Each tab belonging to a collaboration session has a small green circle icon in its tab header. This icon indicates that a connection to the collaboration server has been established, and it turns red if an error occurs (i.e. if you lose the connection to the server).

You will also notice some colored highlights in Collaboration documents that you won't see in normal Komodo documents: All the text you write will be highlighted with a light-blue background. This distinguishes your changes from the original text as well as being distinguishable from the modifications made by other users, which will have a light-green background. Green and red margins on the side help you keep track of the lines that have had text modifications - a green margin indicates text was added; a red margin indicates text was removed.

**Note**: The **Undo** and **Redo** buttons behave differently in a collaboration session. You can not undo any changes that have been made by other users, and your undo history is discarded whenever another user makes a change to the document.
