/**
 * Google Sheets -> Google Drive CSV exporter
 *
 * How to use:
 * 1. Paste this file into an Apps Script project bound to your Google Sheet.
 * 2. Fill in CONFIG.SPREADSHEET_ID and CONFIG.OUTPUT_FOLDER_ID.
 * 3. Run setupKeywordCsvAutomation() once to authorize and create the trigger.
 */
const CONFIG = {
  SPREADSHEET_ID: "1SZqNpSC3tDuEddzZ30g0JqZP7-W90M0E0QUyWV7HZco",
  SHEET_NAME: "시트1",
  OUTPUT_FOLDER_ID: "1sF7qho7VLilL5sdSxz3msF35XSAvwIw2",
  OUTPUT_FILE_NAME: "keyword-audit-source.csv",
  TRIGGER_EVERY_HOURS: 1,
  HEADER_MARKERS: ["연도", "학교명", "구분"],
};

function myFunction() {
  try {
    const result = exportKeywordCsvToDrive();
    const notice = [
      result.message,
      result.fileId ? `fileId: ${result.fileId}` : "",
      result.fileUrl ? `fileUrl: ${result.fileUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      activeSpreadsheet.toast(result.message, "CSV 자동화", 8);
    }
    showNotice_(notice);
    return result;
  } catch (error) {
    const message = `CSV 내보내기 실패: ${formatError_(error)}`;
    showNotice_(message);
    Logger.log(message);
    return { ok: false, message };
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("CSV 자동화")
    .addItem("지금 CSV 내보내기", "exportKeywordCsvToDrive")
    .addItem("자동 저장 트리거 설치", "setupKeywordCsvAutomation")
    .addItem("자동 저장 트리거 삭제", "removeKeywordCsvAutomation")
    .addToUi();
}

function setupKeywordCsvAutomation() {
  exportKeywordCsvToDrive();

  const existingTriggers = ScriptApp.getProjectTriggers().filter(
    (trigger) => trigger.getHandlerFunction() === "exportKeywordCsvToDrive"
  );

  if (!existingTriggers.length) {
    ScriptApp.newTrigger("exportKeywordCsvToDrive")
      .timeBased()
      .everyHours(CONFIG.TRIGGER_EVERY_HOURS)
      .create();
  }
}

function removeKeywordCsvAutomation() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "exportKeywordCsvToDrive") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function exportKeywordCsvToDrive() {
  const sheet = openSourceSheet_();
  const values = sheet.getDataRange().getValues();

  if (!values.length) {
    throw new Error("시트에 내보낼 데이터가 없습니다.");
  }

  const headerRowIndex = findHeaderRowIndex_(values);
  const startRowIndex = headerRowIndex >= 0 ? headerRowIndex : 0;
  const rows = values.slice(startRowIndex);

  if (!rows.length) {
    throw new Error("헤더 이후에 CSV로 저장할 행이 없습니다.");
  }

  const csvText = buildCsv_(rows);
  const blob = Utilities.newBlob(`\uFEFF${csvText}\n`, MimeType.CSV, CONFIG.OUTPUT_FILE_NAME);
  const target = getTargetFolder_();

  removeExistingExports_(target.folder, CONFIG.OUTPUT_FILE_NAME);
  const file = target.folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    message: target.warning
      ? `CSV 저장 완료. (${target.warning})`
      : "CSV 저장 완료",
    folderName: target.folder.getName ? target.folder.getName() : "",
    fileId: file.getId(),
    fileUrl: file.getUrl(),
  };
}

function openSourceSheet_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheet = activeSpreadsheet || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  const sheet = CONFIG.SHEET_NAME
    ? spreadsheet.getSheetByName(CONFIG.SHEET_NAME)
    : spreadsheet.getActiveSheet();

  if (!sheet) {
    throw new Error("대상 시트를 찾지 못했습니다.");
  }

  return sheet;
}

function getTargetFolder_() {
  if (CONFIG.OUTPUT_FOLDER_ID) {
    try {
      const folder = DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID);
      if (folder) {
        return { folder, warning: "" };
      }
    } catch (error) {
      return {
        folder: DriveApp.getRootFolder(),
        warning: `Drive 폴더를 열 수 없어 루트 폴더에 저장했습니다. (${formatError_(error)})`,
      };
    }
  }

  return {
    folder: DriveApp.getRootFolder(),
    warning: "",
  };
}

function removeExistingExports_(folder, fileName) {
  try {
    const files = folder.getFilesByName(fileName);
    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
  } catch (error) {
    // If we cannot clean old exports, we still want the new file to be created.
  }
}

function findHeaderRowIndex_(rows) {
  return rows.findIndex((row) => {
    const normalized = row
      .slice(0, CONFIG.HEADER_MARKERS.length)
      .map((value) => normalizeCell_(value))
      .join(",");
    return normalized === CONFIG.HEADER_MARKERS.join(",");
  });
}

function buildCsv_(rows) {
  return rows.map((row) => row.map((value) => csvEscape_(value)).join(",")).join("\n");
}

function csvEscape_(value) {
  if (value == null) {
    return "";
  }

  const text = String(value);
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function normalizeCell_(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, "")
    .trim();
}

function formatError_(error) {
  if (!error) {
    return "알 수 없는 오류";
  }

  const message = String(error.message ?? error);
  const stack = String(error.stack ?? "");
  return stack ? `${message}\n${stack}` : message;
}

function showNotice_(message) {
  try {
    SpreadsheetApp.getUi().alert(String(message));
  } catch (error) {
    Logger.log(String(message));
  }
}

function probeKeywordCsvAutomation() {
  const report = [];
  try {
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    report.push(`activeSpreadsheet: ${activeSpreadsheet ? "ok" : "null"}`);

    const sheet = openSourceSheet_();
    report.push(`sheet: ${sheet.getName()}`);

    const folderInfo = getTargetFolder_();
    report.push(`folder: ${folderInfo.folder.getName ? folderInfo.folder.getName() : "ok"}`);
    report.push(`folderWarning: ${folderInfo.warning || "none"}`);

    const values = sheet.getDataRange().getValues();
    report.push(`rows: ${values.length}`);
    report.push(`headerRowIndex: ${findHeaderRowIndex_(values)}`);

    showNotice_(report.join("\n"));
    Logger.log(report.join("\n"));
    return report;
  } catch (error) {
    const message = `probe failed: ${formatError_(error)}`;
    showNotice_(message);
    Logger.log(message);
    return [message];
  }
}
