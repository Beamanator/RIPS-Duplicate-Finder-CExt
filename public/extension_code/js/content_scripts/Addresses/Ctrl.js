//----------------------------------------------------------------
//      NOTE: ONLY EDIT CODE IN /public/* - NOT IN /build/*
//----------------------------------------------------------------

// ===============================================================
//                           CONSTANTS
// ===============================================================
const MESSAGE_SOURCE = RIPS_PAGE_KEYS.ADDRESSES;

// ===============================================================
//                          PORT CONNECT
// ===============================================================
const port = chrome.runtime.connect({ name: PCs.PORTNAME_CS_ADDRESSES });

// ===============================================================
//                         MAIN FUNCTIONS
// ===============================================================
const getPageDataArr = () => {
    const columnNames = [];
    const columnNameMap = {
        'First Line of Address': FIRST_ADDRESS_LINE,
        'Telephone': ADDRESS_TELEPHONE,
        'From': ADDRESS_DATE_FROM,
        'Until': ADDRESS_DATE_TO,
        'Current?': '', // skip
        '': ''
    }

    // populate column names array
    const tableHeaderCellsSelector =
        FIELD_IDS_ADDRESSES[ADDRESS_TABLE_HEADER_CELLS];
    document.querySelectorAll(tableHeaderCellsSelector)
    .forEach(cell => {
        const cellName = cell.innerText.trim();
        
        // push all mapped column names to columnNames array
        const mappedName = columnNameMap[cellName];

        if (mappedName === undefined) {
            // TODO: throw error, stop the import - mapping failed
            const err = `Cell "${cellName}" failed to map! Investigate!`;
            Utils_Error(MESSAGE_SOURCE, err);
        } else {
            columnNames.push(mappedName);
        }
    });

    // search through address data and send to bkg
    const addresses = [];
    const tableBodyRowsSelector =
        FIELD_IDS_ADDRESSES[ADDRESS_TABLE_BODY_ROWS];
    document.querySelectorAll(tableBodyRowsSelector)
    .forEach(row => {
        // make new objects for each row
        const addressRowData = {};

        // get address data from specific row
        const tableBodyCellsFromRowsSelector =
            FIELD_IDS_ADDRESSES[ADDRESS_TABLE_BODY_CELLS_FROM_ROWS];
        row.querySelectorAll(tableBodyCellsFromRowsSelector)
        .forEach((cell, colIndex) => {
            // if there's no column name, skip this cell's data
            if (columnNames[colIndex] == '') {
                // do nothing - not a useful column
            }
            // add cell data (cell.innerText) to row object
            else {
                const cellData = cell.innerText;
                const cellMapName = columnNames[colIndex];
                // map data to columnNameMap in row data obj
                addressRowData[cellMapName] = cellData;
            }
        });
        
        // push row data onto addresses array
        addresses.push(addressRowData);
    });

    // data gathered, now send it back to background.js to store
    return addresses;
}

const startImport = () => {
    // first, get page data
    const addressData = {
        [ADDRESSES]: getPageDataArr()
    };

    // send data to background.js
    Utils_SendDataToBkg(port, MESSAGE_SOURCE, addressData);

    // redirect to next page (Notes)
    Utils_SendRedirectCode(port, 'ClientDetails/ClientNotes');
}

const startMerge = ( mData, dataIndex ) => {
    // first, get data existing on the page
    const currentAddresses = getPageDataArr();
    // pull out address data from mData
    const mAddressData = mData[MESSAGE_SOURCE];

    // next, filter out existing addresses from mData
    const newAddresses = mAddressData.filter(mAdr => {
        // by default, merge address doesn't exist (yet)
        let addressExists = false;

        // loop through current addresses on client
        currentAddresses.forEach(cAdr => {
            // quit early if possible
            if (addressExists) return;
            
            // by default, assume mAdr and cAdr match
            let adrMatch = true;
            
            // loop through keys of currentAddress to find
            // -> matching values
            Object.entries(cAdr).forEach(([adrKey, cAdrVal]) => {
                // quit early if possible
                if (!adrMatch) return;
                
                // if vals DON'T match, set 'adrMatch' to false!
                if (mAdr[adrKey] !== cAdrVal) {
                    adrMatch = false;
                }
            });
            
            // if mAdr matches cAdr, set 'addressExists' flag to true!
            if (adrMatch) addressExists = true;
        });
        
        // if addressExists, return false (filter)
        // -> if doesn't exist, return true (don't filter)
        return !addressExists
    });

    // 1) Get next address to add to client
    let nextAddressData = null;

    // if index is out of range, no more to add! redirect to next page!
    if (dataIndex > newAddresses.length - 1) {
        Utils_SendRedirectCode(port, 'ClientDetails/ClientNotes');
    }
    // else, not out of range, so set next address data to save :)
    else {
        nextAddressData = newAddresses[dataIndex];
    }

    // 2) Click "Add Address" to open up form elements
    const newAddressBtnSelector = FIELD_IDS_ADDRESSES[ADDRESS_NEW_BUTTON];
    const newAddressBtnElem = document.querySelector(newAddressBtnSelector);
    newAddressBtnElem.click();

    // 3) Populate 'new address' form elements
    const [
        addressLine1Selector, addressPhoneSelector,
        addressDateFromSelector, addressDateToSelector
    ] = [
        FIELD_IDS_ADDRESSES[ADDRESS_NEW_LINE1],
        FIELD_IDS_ADDRESSES[ADDRESS_NEW_PHONE],
        FIELD_IDS_ADDRESSES[ADDRESS_NEW_DATE_FROM], 
        FIELD_IDS_ADDRESSES[ADDRESS_NEW_DATE_TO],
    ];

    // TODO: wait till at least one of these fields is displaying, then move forward
    debugger;

    const [
        addressLine1Elem, addressPhoneElem,
        addressDateFromElem, addressDateToElem
    ] = [
        document.querySelector(addressLine1Selector),
        document.querySelector(addressPhoneSelector),
        document.querySelector(addressDateFromSelector),
        document.querySelector(addressDateToSelector),
    ];

    // error if we didn't find all elements ;)
    if ( !addressLine1Elem || !addressPhoneElem || !addressDateFromElem || !addressDateToElem ) {
        const err = `Some address elem(s) not found!`;
        Utils_Error(
            MESSAGE_SOURCE, err,
            ADDRESS_NEW_LINE1, addressLine1Elem, addressLine1Selector,
            ADDRESS_NEW_PHONE, addressPhoneElem, addressPhoneSelector,
            ADDRESS_NEW_DATE_FROM, addressDateFromElem, addressDateFromSelector,
            ADDRESS_NEW_DATE_TO, addressDateToElem, addressDateToSelector
        );
        return;
    }

    addressLine1Elem.value = nextAddressData[FIRST_ADDRESS_LINE];
    addressPhoneElem.value = nextAddressData[ADDRESS_TELEPHONE];
    addressDateFromElem.value = nextAddressData[ADDRESS_DATE_FROM];
    addressDateToElem.value = nextAddressData[ADDRESS_DATE_TO];

    // 4) update background.js' merge data index before clicking 'save'
    sendIncrementMergeDataIndex();

    // 5) Click "Save" (update next address index to add - in bkg.js)
    const addressSaveBtnSelector = FIELD_IDS_ADDRESSES[ADDRESS_NEW_SAVE_BUTTON];
    const addressSaveBtnElem = document.querySelector(addressSaveBtnSelector);
    // TODO: click it!
    // addressSaveBtnElem.click();


    // TODO: FIXME: here!
    console.error('WE HERE BABY', dataIndex);
    debugger;
}

// ================================================================
//                     MESSAGE POSTING FUNCTIONS
// ================================================================
// Note: port codes come from "../js/portCodes.js"
const sendIncrementMergeDataIndex = () => {
	port.postMessage({
		code: PCs.CS_BKG_INCREMENT_MERGE_DATA_INDEX
	});
};

// ================================================================
//                          PORT LISTENERS
// ================================================================

port.onMessage.addListener(msg => {
    const {
		code, mergeData, mergeDataIndex,
		autoImport, autoMerge,
		postSaveRedirectFlag
    } = msg;
    
    Utils_Log(MESSAGE_SOURCE, 'port msg received', msg);

    switch ( code ) {
        case PCs.BKG_CS_INIT_PORT:
            Utils_Log(MESSAGE_SOURCE, `Successfully connected to background.js`);
            
            // if flag is set to true, we already saved, so now we just
			// -> have to redirect the user to the next step!
			if (postSaveRedirectFlag) {
				Utils_SendRedirectCode(port, 'ClientDetails/ClientNotes');
				return;
			}

            // fail if multiple automatic triggers are true
            // -> (can't do > 1 thing at same time)
            if (autoImport && autoMerge) {
                Utils_Error(MESSAGE_SOURCE, 'Auto import / merge are both true! :(');
                return;
            }
            
            // if any auto flag is true, start automatically!
            if (autoImport) { startImport(); }
            if (autoMerge) { startMerge( mergeData, mergeDataIndex ); }
            break;

        case PCs.BKG_CS_START_IMPORT:
        case PCs.BKG_CS_START_MERGE:
			Utils_SendRedirectCode(port, 'SearchClientDetails/AdvancedSearch');
            break;

        default: // code not recognized - send error back
			Utils_SendPortCodeError(port, code, PCs.PORTNAME_CS_ADDRESSES);
    }
});