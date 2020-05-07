/*
 * Copyright (c) 2006 Tony Chang, Ted Mielczarek
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE CONTRIBUTORS ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE REGENTS AND CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
var dp = new DOMParser();

function decorate() {
  var expr = document.getElementById('expr').value;
  var in_txt = document.getElementById('in').value;
  var d = document.getElementById('out').contentDocument.body;
  var x;
  
  try {
    x = dp.parseFromString(in_txt, 'text/xml');
  } catch (e) {
    // show error message
    document.getElementById('in').className = 'error';
    return;
  }

  if(x.documentElement.nodeName == 'parsererror') {
    // show error message
    document.getElementById('in').className = 'error';
    return;
  }
  // no error
  document.getElementById('in').className = '';

  try {
    var nodes = document.evaluate(expr, x, null,
                                  XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                  null);
  } catch (e) {
    // show error message
    document.getElementById('expr').className = 'error';
    return;
  }
  // no error
  document.getElementById('expr').className = '';
  
  for (var i = 0; i < nodes.snapshotLength; ++i) {
    var elt = nodes.snapshotItem(i);
    elt.marked = true;
  }
  
  // output the tree
  var walker = document.createTreeWalker(x, NodeFilter.SHOW_ALL, 
      {
        acceptNode : function(node) {
          if (node.nodeType == Node.TEXT_NODE &&
              !(/[^\t\n\r ]/.test(node.nodeValue)))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }, true);
  
  // generate the output tree
  d.innerHTML = '';
  addTree(walker, d);
}

// This function was taken from 
// http://www.mozilla.org/docs/dom/samples/treewalkerdemo.xml
/*
 * Function that is called recursivly to create the output tree
 * Note how this function is exactly the same independingly on what
 * filter we use, the TreeWalker handles the filtering for us
 */
function addTree(walker, destNode) {
  // walk the TreeWalker tree...
  if(walker.firstChild()) {
    do {
      // ...and create an output node for every node we find
      var curNode = walker.currentNode
        var newNode;
      switch (curNode.nodeType) {
      case Node.ELEMENT_NODE:
        newNode = document.createElementNS(null, "tag");
        newNode.setAttribute("name", curNode.nodeName);
        break;

      default:
        newNode = document.createElementNS(null, "text");
        newNode.setAttribute("value", curNode.nodeValue);
        break;
      }
      if (curNode.marked) {
        newNode.setAttribute('marked', 'true');
      }

      // insert the output node and recursivly walk the children
      // of every node
      destNode.appendChild(newNode);
      addTree(walker, newNode);
    } while(walker.nextSibling());

    // don't forget to return the treewalker to it's previous state
    // before exiting the function
    walker.parentNode();
  }
}

function load()
{
  loadFileToTextbox(window, document.getElementById('in'), 'xml');
  decorate();
}

function save()
{
  saveFileFromTextbox(window, document.getElementById('in'), 'xml');
}
