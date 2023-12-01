var csInterface = new CSInterface();
const extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);

const xmlFileSelect = document.getElementById("xml-file-select");
const xmlFileInput = document.getElementById("xml-file");
const xmlFileName = document.getElementById("xml-file-name");
var xmlFile;

const layoutsFolderSelect = document.getElementById("layouts-folder-select");
const layoutsFolderInput = document.getElementById("layouts-folder-input");
const layoutsFolderPath = document.getElementById("layouts-folder-path");

const layoutSelect = new CustomSelect(document.getElementById("layout-select"));

const checkboxUntag = document.getElementById("checkbox-untag");

const importFilesBtn = document.getElementById("import-files-btn");

xmlFileSelect.addEventListener("click", async function () {
  var articleId = document.getElementById("xml-file").value;
  await fetch(`https://services.api.no/api/content/acp/${articleId}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error("Network error");
      }
      return res.json();
    })
    .then((data) => {
      var options = { compact: true, ignoreComment: true, spaces: 4 };
      let xmlTemp = json2xml(data, options);
      let replacedString = xmlTemp.replace(/&lt;/g, "<");
      let replacedString2 = replacedString.replace(/&gt;/g, ">");
      var xmlData = `<?xml version="1.0"?><aHistorie>${replacedString2}</aHistorie>`;
      // <?xml version="1.0"?>

      xmlFile = xmlData;
      createFile();
      alert("Artcle Fetched");
    })
    .catch((error) => {
      alert("Error Fetching the article!!! Check id! error: " + error);
    });
});

const fs = require("fs");
const path = require("path");
const os = require("os");
var xmlfilePath;

function createFile() {
  const tempFolderPath = path.join(os.tmpdir(), "myTempFolder");

  // Create the temporary folder if it doesn't exist
  if (!fs.existsSync(tempFolderPath)) {
    fs.mkdirSync(tempFolderPath);
  }
  xmlfilePath = path.join(tempFolderPath, "example.xml");

  fs.writeFile(xmlfilePath, xmlFile, "utf8", (err) => {
    if (err) {
      console.error("Error creating file:", err);
    } else {
      console.log("File created successfully!");
    }
  });
}
// xmlFileInput.addEventListener("input", (event) => {
//   const filePath = event.target.files[0].name;

//   if (filePath) xmlFileName.innerText = filePath;
// });

layoutsFolderSelect.addEventListener("click", function () {
  layoutsFolderInput.click();
});

layoutsFolderInput.addEventListener("input", (event) => {
  const filePath = event.target.files[0].path;
  const directory = filePath.substring(0, filePath.lastIndexOf("/"));

  if (filePath) layoutsFolderPath.innerText = directory;
});

layoutsFolderInput.addEventListener("change", (event) => {
  var allowedExtensions = /(\.idms)$/i;
  layoutSelect.clearOptions();
  const files = event.target.files;
  const filteredFiles = Array.from(files).filter((file) =>
    allowedExtensions.exec(file.path)
  );

  if (filteredFiles.length > 0) {
    filteredFiles.forEach((file) =>
      layoutSelect.addOption(file.path, file.name)
    );
  } else {
    layoutSelect.disable();
    layoutsFolderPath.innerText = "No folder selected";
  }
});

importFilesBtn.addEventListener("click", function () {
  var articleId = document.getElementById("xml-file").value;
  var idmsFilePath = layoutSelect.value();
  if (!xmlFile || !idmsFilePath) {
    alert("Please select an IDMS file and enter correct Article Id");
    return;
  }

  var xmlfilepath = "abc";
  var untag = checkboxUntag.checked;

  csInterface.evalScript(
    'importXMLFile("' +
      xmlfilePath +
      '","' +
      idmsFilePath +
      '","' +
      extensionPath +
      '","' +
      untag +
      '")',
    function (res) {
      if (res === "success") {
        fs.unlink(xmlfilePath, (err) => {
          if (err) {
            console.error("Error deleting file:", err);
          } else {
            console.log("File deleted successfully!");
          }
        });
        alert("File imported successfully!");
      } else {
        alert("Error importing file: " + res);
      }
    }
  );
});
