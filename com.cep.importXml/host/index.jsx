/**
 * Imports given XML file to Adobe InDesign active document if it is available.
 * @param {string} xmlFilePath Path to XML file which have to be imported.
 * @param {string} snippetPath Path to IDSM snippet file for selected XML.
 * @returns {string} Status of function execution or error message.
 */
function importXMLFile(xmlFilePath, snippetPath, extensionPath, untag) {
  if (app.documents.length === 0) {
    return "No document is currently open.";
  }
  var xmlFile = new File(xmlFilePath);
  if (!xmlFile.exists) {
    return "The XML file does not exist at the specified path.";
  }

  var idmsFile = new File(snippetPath);
  if (!idmsFile.exists) {
    return "The IDMS file does not exist at the specified path.";
  }

  // Construct the path to the XML file
  var xslFilePath = extensionPath + "/xmlID-import.xsl";

  // Create a File object for the XML file
  var xslFile = new File(xslFilePath);
  if (!xslFile.exists) {
    return "The XSL file does not exist at the specified path.";
  }

  // Top-level tag name should be derived from the snippet filename.
  // We grab the word up to the first dash/space/period.
  var snippetFn = snippetPath.toString().split("/").pop();
  var prefixParts = snippetFn.match(/^([^- \.,\#]+)/);
  var xslParams =
    prefixParts && prefixParts[1] ? { prefix: prefixParts[1] } : {};

  var result = "success";

  try {
    app.doScript(
      function () {
        var placeErrors = doPlacement(
          xmlFile,
          snippetPath,
          xslFile,
          xslParams,
          untag
        );
        if (placeErrors && placeErrors.length) {
          result = "Placement Errors\n" + placeErrors.join("\n");
        }
      },
      ScriptLanguage.JAVASCRIPT,
      [],
      UndoModes.ENTIRE_SCRIPT,
      "Import XML file"
    );
  } catch (error) {
    return error.message;
  }

  return result;
}

/**
 * Does XML file with IDSM snippet placement in Adobe InDesign document.
 * @param {File} xmlFile XML file which have to be imported.
 * @param {string} snippetPath Path to IDSM snippet file for selected XML.
 * @param {File} xslFile XSL markup file for mapping XML tags.
 * @param {Object} xslParams Object with XSL markup params.
 * @param {boolean} untag If set to true, the XML elements will be untagged.
 * @returns {string[]} Array of placement errors if any occurs.
 */
function doPlacement(xmlFile, snippetPath, xslFile, xslParams, untag) {
  var doc = app.documents[0];

  var rootElem = doc.xmlElements.firstItem();
  if (rootElem) {
    // Are there already top-level XML nodes bound for the given tag?
    // We check for presence of tags named with the given prefix.
    if (xslParams && xslParams.prefix) {
      var match = 0;
      var rootChs = rootElem.xmlElements.everyItem().getElements();
      for (var i = 0; i < rootChs.length; i++) {
        var ch = rootChs[i];
        if (ch.markupTag.name.indexOf(xslParams.prefix + "-") === 0) {
          var pi = ch.xmlContent;
          if (pi && pi.isValid) {
            match++;
            break;
          }
        }
      }

      if (!match) {
        // Snippet not yet placed. We cannot use the place gun since it's
        // asynchronous and our script will terminate before it completes.
        // Instead we place onto the active page and group the items if
        // they aren't yet grouped.
        var pg = getActivePage(doc) || doc.pages[0];
        var placedPis = pg.place(snippetPath);
        if (placedPis && placedPis.length > 1) {
          doc.groups.add(placedPis);
        }
        if (!placedPis) return "No snippet placed in document.";
      }
    }

    // Continue with placement
    return doPlacementInDocument(doc, xmlFile, xslFile, xslParams, untag);
  }

  return "Could not find root element.";
}

/**
 * Defines if given object is master spread.
 * @param {Object} obj Object for property check.
 * @returns {boolean}
 */
function isMasterSpread(obj) {
  return "baseName" in obj;
}

/**
 * Returns active page for given document.
 * @param {Document} doc Adobe InDesign document object.
 * @returns {(Page|undefined)}
 */
function getActivePage(doc) {
  var win = doc.layoutWindows.length && doc.layoutWindows[0];
  if (win && !isMasterSpread(win.activeSpread)) {
    return win.activePage;
  }

  return undefined;
}

/**
 * Does XML file placement in document.
 * @param {Documen} doc Adobe InDesign document object.
 * @param {File} xmlFile XML file which have to be imported.
 * @param {File} xslFile XSL markup file for mapping XML tags.
 * @param {Object} xslParams Object with XSL markup params.
 * @param {boolean} untag If set to true, the XML elements will be untagged.
 * @returns {string[]} Array of placement errors if any occurs.
 */
function doPlacementInDocument(doc, xmlFile, xslFile, xslParams, untag) {
  // Create temporary node for the new XML data
  var rootElem = doc.xmlElements.firstItem();
  var tempElem = rootElem.xmlElements.add("TEMP");
  importXMLData(doc, tempElem, xmlFile, xslFile, xslParams);

  // Move data into the final destination and map styles
  var articleTag = tempElem.xmlElements.firstItem().markupTag.name;
  if (xslParams && xslParams.prefix !== articleTag) {
    return [
      "Tag name mismatch in imported file: <" + articleTag + ">",
      "Snippet: <" + xslParams.prefix + ">",
      "Aborting import.",
    ];
  }

  var placeErrors = bindMatchingTags(rootElem, tempElem, articleTag);
  mapTagsToStyles(doc, rootElem, articleTag);
  doc.mapXMLTagsToStyles();

  if (untag === "true") {
    untagElements(rootElem);
  }

  return placeErrors;
}

/**
 * Processes XML data from given XML File and XSL markup.
 * @param {Document} doc Adobe InDesign document object.
 * @param {XMLItem} elem Element where XML will be imported.
 * @param {File} xmlFile XML file which have to be imported.
 * @param {File} xslFile XSL markup file for mapping XML tags.
 * @param {Object} xslParams Object with XSL markup params.
 */
function importXMLData(doc, elem, xmlFile, xslFile, xslParams) {
  // Import XML beneath the given node. Any tags with href attributes get
  // an anchored image inserted automatically.
  var xmlFile = xmlFile;
  var xslFile = xslFile;
  if (xmlFile) {
    var xp = doc.xmlImportPreferences;
    xp.importStyle = XMLImportStyles.APPEND_IMPORT;
    if (xslFile) xp.transformFilename = xslFile;
    xp.allowTransform = xslFile ? true : false;
    xp.createLinkToXML = false;
    xp.ignoreWhitespace = false;
    xp.importToSelected = true;
    xp.repeatTextElements = false;
    xp.removeUnmatchedExisting = false;
    if (xslParams) {
      // Convert mapping to [ [ name, value], [ name, value ], ... ]
      var params = [];
      for (var key in xslParams)
        if (xslParams.hasOwnProperty(key)) params.push([key, xslParams[key]]);
      xp.transformParameters = params;
    }

    try {
      elem.select();
      elem.importXML(xmlFile);
    } catch (e) {}
  }
}

/**
 * Untags given XML element items.
 * @param {XMLItem} rootElem XML element which items should be untagged.
 */
function untagElements(rootElem) {
  var elements = rootElem.xmlElements.everyItem().getElements();
  for (var i = elements.length - 1; i >= 0; i--) {
    var element = elements[i];
    if (element.isValid && element.xmlContent) element.untag();
  }
}

/**
 * Binds matching tags to the page.
 * @param {XMLItem} rootElem
 * @param {XMLItem} sourceElem
 * @param {string} articleTag
 * @returns {string[]}
 */
function bindMatchingTags(rootElem, sourceElem, articleTag) {
  // The source element should be added as the last top-level child to the
  // root. The first child holds the prefix name that we are processing,
  // and we'll scan through previous children to find any candidate nodes
  // with bindingds to the page that we can refresh.
  var remap = {};
  var placeErrors = [];

  function recursiveScan(e) {
    var children = e.xmlElements.everyItem().getElements();
    for (var i = 0; i < children.length; i++) {
      var ch = children[i];
      if (ch === sourceElem) break;

      var childTagName = ch.markupTag.name;
      if (childTagName.indexOf(articleTag + "-") === 0) {
        // Always recurse even if we've already mapped an identical name
        // in a different place. This allows us to add dummy "prefix-group"
        // nodes to text frames.
        recursiveScan(ch);

        if (remap[childTagName]) continue;

        // Candidate node. Check whether it's bound to a page item.
        var pi = ch.xmlContent;
        if (pi && pi.isValid) {
          remap[childTagName] = ch;
        }
      }
    }
  }
  recursiveScan(rootElem);

  // Now recurse through the source tree and bind anything that overlaps
  // with the remappable entries.
  function recursivePlace(e) {
    var tagName = e.markupTag.name;
    if (remap[tagName]) {
      // Preserve ref to element we'll delete soon and rebind to new data.
      var oldElem = remap[tagName];
      var pi = oldElem.xmlContent;
      var placedNormally = false;

      if (isStory(pi) || isPageItem(pi)) {
        // There could be errors thrown if an image path cannot be resolved
        try {
          pi.placeXML(e);
        } catch (err) {
          var hrefAttr = e.xmlAttributes.itemByName("href");
          if (hrefAttr && hrefAttr.isValid)
            placeErrors.push(
              "\u2022 Could not place: \u201c" + hrefAttr.value + "\u201d."
            );
        }
        placedNormally = true;

        // If this is a text container we need to trim any trailing
        // empty paragraphs and perhaps apply other clean-up.
        if (isStory(pi)) pi = pi.textContainers[0];
        if (isTextContainer(pi)) {
          cleanupParas(pi);
        }
      }

      if (placedNormally) {
        // Delete left-over XML element now that it's been rebound, and
        // move the newly bound node directly under the root node.
        oldElem.remove();
        e.move(LocationOptions.BEFORE, sourceElem);
      } else {
        // Set text content in currently bound page destination. This is
        // typically a range of some kind. This probably only works for
        // string data, not nested elements.
        oldElem.contents = e.contents;
      }

      // Don't try to map this key from now on
      remap[tagName] = undefined;
    } else {
      // Only recurse if we didn't update anything
      var children = e.xmlElements.everyItem().getElements();
      for (var i = 0; i < children.length; i++) recursivePlace(children[i]);
    }
  }
  recursivePlace(sourceElem);

  for (var key in remap) {
    if (remap[key]) {
      var e = remap[key];

      if (e.isValid) {
        if (e.xmlElements.count() > 0) continue;
        e.remove();
      }
    }
  }

  var myStories = app.activeDocument.stories.everyItem().getElements();
  for (i = myStories.length - 1; i >= 0; i--) {
    var myTextFrames = myStories[i].textContainers;
    for (j = myTextFrames.length - 1; j >= 0; j--) {
      if (myTextFrames[j].contents == "") {
        myTextFrames[j].remove();
      }
    }
  }

  // Clean up the source element which is no longer needed
  sourceElem.remove();
  return placeErrors.sort();
}

/**
 * Returns true for PageItem and its derived classes (currently
 * EPSText, FormField, Button, MultiStateObject, Graphic, EPS,
 * Image, ImportedPage, PDF, PICT, WMF, Group, MediaItem, Movie,
 * Sound, SplineItem, GraphicLine, Oval, Polygon, Rectangle, and
 * TextFrame).
 * @param {Object} obj
 * @returns {boolean}
 */
function isPageItem(obj) {
  return "appliedObjectStyle" in obj;
}

/**
 * Returns true for any page item that can contain text (currently TextFrame and TextPath).
 * @param {Object} obj
 * @returns {boolean}
 */
function isTextContainer(obj) {
  return "nextTextFrame" in obj;
}

/**
 * Returns true if given object is instance of type Story.
 * @param {Object} obj
 * @returns {boolean}
 */
function isStory(obj) {
  return obj instanceof Story;
}

/**
 * Clean ups given paragraph item story.
 * @param {ParagraphItem} pi
 */
function cleanupParas(pi) {
  var story = pi.parentStory;

  // Expand linebreaks
  replaceInStory(story, "[[\\n]]", "\n");

  // Remove trailing paragraph break
  var endpos = story.insertionPoints.lastItem().index - 1;
  if (endpos >= 0) {
    if (story.characters[endpos].contents === "\r") {
      var range = story.characters.itemByRange(endpos, endpos).getElements()[0];
      range.remove();
    }
  }
}

/**
 * Replaces data in Adobe InDesign Story instance.
 * @param {Story} story Adobe InDesign Story class that represents a story (a block of text) in a document.
 * @param {string} from Argument which will be replaced.
 * @param {string} to New value for the argument.
 */
function replaceInStory(story, from, to) {
  var fromFirstCh = from.substr(0, 1);
  var paras = story.paragraphs;
  for (var i = 0; i < paras.length; i++) {
    var p = paras[i];
    var iters = 0;
    while (p.contents.indexOf(from) >= 0) {
      if (iters++ > 20) break;
      var ch = p.characters.everyItem().getElements();
      for (var j = 0; j < ch.length - from.length - 1; j++) {
        if (ch[j].contents === fromFirstCh) {
          //  Candidate for replacement
          var range = p.characters.itemByRange(j, j + from.length - 1);
          if (range.contents.toString() === from) {
            range.contents = to;
            break;
          }
        }
      }
    }
  }
}

/**
 * Maps XML tags to the corresponding styles.
 * @param {Document} doc Adobe InDesign document object.
 * @param {XMLItem} elem Element whose styles will be mapped.
 * @param {string} articleTag
 */
function mapTagsToStyles(doc, elem, articleTag) {
  // Recurse through elem children to find all unique tags in use
  var tags = {};

  function recurse(e) {
    var tag = e.markupTag;
    if (tag.name.indexOf(articleTag + "-") === 0) {
      if (!tags[tag.id]) tags[tag.id] = tag;
    }
    var children = e.xmlElements.everyItem().getElements();
    for (var i = 0; i < children.length; i++) recurse(children[i]);
  }
  recurse(elem);

  // Skip any mapping already present in the document
  var maps = doc.xmlImportMaps;
  for (var m = 0; m < maps.length; m++) delete tags[maps[m].markupTag.id];

  // Add new mapping for remaining entries if they can be resolved to a
  // paragraph style.
  var splitNumSuffixRE = RegExp(/^([a-zA-Z-]+)(-[0-9]+)$/);
  var splitBodySuffixRE = RegExp(/^([a-zA-Z-]+)(-body)$/);
  for (var tagId in tags) {
    // Try full tag name first, and then without any -99 suffix, and
    // also without any -body suffix.
    var tag = tags[tagId];
    var tagName = tag.name;
    var ps = resolveParaStyleName(doc, tagName);
    if (!ps) {
      var tagSplitNumSuffix = tagName.match(splitNumSuffixRE);
      if (tagSplitNumSuffix) {
        var tagName2 = tagSplitNumSuffix[1];
        ps = resolveParaStyleName(doc, tagName2);
      }
    }
    if (!ps) {
      var tagSplitBodySuffix = tagName.match(splitBodySuffixRE);
      if (tagSplitBodySuffix) {
        var tagName2 = tagSplitBodySuffix[1];
        ps = resolveParaStyleName(doc, tagName2);
      }
    }
    if (ps) {
      maps.add(tag, ps);
    } else {
      // Also give character styles a chance. This time we won't try different suffix endings.
      var cs = resolveCharStyleName(doc, tagName);
      if (cs) {
        maps.add(tag, cs);
      }
    }
  }
}

/**
 * Returns resolved paragraph style name or undefined if nothing matches.
 * @param {Document} doc Adobe InDesign document object.
 * @param {string} styleName Style name which have to be resolved.
 * @returns {(ParagraphStyle|undefined)}
 */
function resolveParaStyleName(doc, styleName) {
  // If name contains "-" we resolve the first part as a group name
  var group = undefined;
  var dashPos = styleName.indexOf("-");
  if (dashPos > 0) {
    var groupName = styleName.substr(0, dashPos);
    styleName = styleName.substr(dashPos + 1);
    var groupList = doc.paragraphStyleGroups;
    group = groupList && groupList.itemByName(groupName);
    if (group && !group.isValid) group = undefined;
  }

  var list = group ? group.paragraphStyles : doc.allParagraphStyles;
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === styleName) {
      var style = list[i];
      return style.isValid ? style : undefined;
    }
  }

  return undefined;
}

/**
 * Returns resolved character style name or undefined if nothing matches.
 * @param {Document} doc Adobe InDesign document object.
 * @param {string} styleName Style name which have to be resolved.
 * @returns {(CharacterStyle|undefined)}
 */
function resolveCharStyleName(doc, styleName) {
  //  If name contains "-" we resolve the first part as a group name
  var group = undefined;
  var dashPos = styleName.indexOf("-");
  if (dashPos > 0) {
    var groupName = styleName.substr(0, dashPos);
    styleName = styleName.substr(dashPos + 1);
    var groupList = doc.characterStyleGroups;
    group = groupList && groupList.itemByName(groupName);
    if (group && !group.isValid) group = undefined;
  }

  var list = group ? group.characterStyles : doc.allCharacterStyles;
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === styleName) {
      var style = list[i];
      return style.isValid ? style : undefined;
    }
  }

  return undefined;
}
