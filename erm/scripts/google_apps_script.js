/**
 * Google Apps Script (GAS) - MWA Raw Water Turbidity Scraper
 * 
 * นำโค้ดนี้ทั้งหมดไปวางใน https://script.google.com
 * แล้วกด Deploy > New deployment > Web app
 * - Execute as: Me
 * - Who has access: Anyone
 */

function doGet(e) {
  try {
    var url = 'http://rwc.mwa.co.th/page/home/table.php';
    
    // ดึงหน้าเว็บตาราง กปน. พร้อม Custom User-Agent
    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    var code = response.getResponseCode();
    if (code !== 200) {
      throw new Error('HTTP Status ' + code);
    }

    var html = response.getContentText('UTF-8');
    var result = parseMwaTable(html);

    // ส่งออกข้อมูลในรูปแบบ JSON รองรับ CORS โดยอัตโนมัติ
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ล้าง HTML tags และช่องว่างส่วนเกิน
 */
function cleanText(htmlFragment) {
  if (!htmlFragment) return '';
  return htmlFragment.replace(/<[^>]+>/g, '').trim();
}

/**
 * แยกข้อมูลสถานีทั้ง 6 จุดจากตาราง HTML
 */
function parseMwaTable(html) {
  var targetStations = [
    { id: 'S16', search_name: 'แควน้อย', name: 'แควน้อย' },
    { id: 'T5',  search_name: 'แควใหญ่', name: 'แควใหญ่' },
    { id: 'S11', search_name: 'แม่กลอง', name: 'แม่กลอง' },
    { id: 'S9',  search_name: 'ท่าม่วง',  name: 'ท่าม่วง' },
    { id: 'S12', search_name: 'บางเลน กม.35', name: 'บางเลน กม.35' },
    { id: 'S14', search_name: 'คลองตะวันตก กม.14', name: 'คลองตะวันตก กม.14' }
  ];

  var rowMatches = html.match(/<TR>([\s\S]*?)<\/TR>/gi) || [];
  var extracted = {};
  var updateTime = '';
  var updateDate = '';

  for (var i = 0; i < targetStations.length; i++) {
    var st = targetStations[i];
    var found = false;

    for (var j = 0; j < rowMatches.length; j++) {
      var row = rowMatches[j];
      if (row.indexOf('id=' + st.id) !== -1 || row.indexOf(st.search_name) !== -1) {
        var colMatches = row.match(/<TD.*?>([\s\S]*?)<\/TD>/gi) || [];
        if (colMatches.length >= 7) {
          // คอลัมน์: 0=สถานี, 1=ระยะทาง, 2=วันที่, 3=เวลา, 4=pH, 5=ความเค็ม, 6=ความขุ่น
          var rowDate = cleanText(colMatches[2]);
          var rowTime = cleanText(colMatches[3]);
          var rawTurb = cleanText(colMatches[6]) || '-';

          if (rowTime) updateTime = rowTime;
          if (rowDate) updateDate = rowDate;

          var turbVal = null;
          var parsed = parseFloat(rawTurb);
          if (!isNaN(parsed)) {
            turbVal = parsed;
          }

          var isHigh = (turbVal !== null && turbVal > 100);

          extracted[st.id] = {
            id: st.id,
            name: st.name,
            turbidity: turbVal,
            raw_turbidity: rawTurb,
            is_high: isHigh,
            date: rowDate,
            time: rowTime
          };
          found = true;
          break;
        }
      }
    }

    if (!found) {
      extracted[st.id] = {
        id: st.id,
        name: st.name,
        turbidity: null,
        raw_turbidity: '-',
        is_high: false,
        date: updateDate,
        time: updateTime
      };
    }
  }

  var ordered = [];
  for (var k = 0; k < targetStations.length; k++) {
    ordered.push(extracted[targetStations[k].id]);
  }

  return {
    status: 'success',
    source: 'live',
    date: updateDate,
    time: updateTime,
    updated_at: new Date().toISOString(),
    data: ordered
  };
}
