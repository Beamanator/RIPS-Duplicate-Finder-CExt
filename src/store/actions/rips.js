import * as actionTypes from './actionTypes';
import * as portCodes from '../portCodes';
import * as actions from './index';

import { tableConfigs } from '../../shared/ripsTableConfigHolder';
import { formatRawData } from '../../shared/ripsFormatRawData';

// clear rips redux data
export const ripsClearRedux = () => {
    return {
        type: actionTypes.RIPS_CLEAR_REDUX
    };
};
// container for clearing all data in the program
export const ripsClearAllData = (port) => {
    return dispatch => {
        // clear redux data related to rips
        dispatch(ripsClearRedux());

        // clear background data
        port.postMessage({
            code: portCodes.RA_BKG_CLEAR_ALL_DATA
        });
    };
}
// tell UI the process has started
const ripsFetchStart = () => {
    return {
        type: actionTypes.RIPS_FETCH_START
    };
};
// fail :(
const ripsFetchFail = (error) => {
    return {
        type: actionTypes.RIPS_FETCH_FAIL,
        error: error
    };
};
// success! done! - called by port.js actions
export const ripsFetchSuccess = (ripsData) => {
    // format RIPS data and pass to store
    let formattedData = {};
    tableConfigs.forEach(({ key: tableKey, type }) => {
        formattedData[tableKey] =
            formatRawData(ripsData[tableKey], tableKey, type)
    })
    return {
        type: actionTypes.RIPS_FETCH_SUCCESS,
        data: formattedData
    };
};
// KICK OFF PROCESS - collect rips data
export const ripsFetchData = (port, clientNums) => {
    return dispatch => {
        // begin collecting data
        dispatch(ripsFetchStart());

        // if in development mode, port may not be available
        if (!port) {
            const errMsg = 'No Port available! Check connection & environment';
            dispatch(ripsFetchFail(errMsg));
            return;
        }

        // Here, send message to background to start collecting data
        port.postMessage({
            code: portCodes.RA_BKG_START_IMPORT,
            clientNums: clientNums
        });

        // NOTE: data import actions are called
        // -> and handled in actions/port.js - via a port listener
    };
};
// beginning of rips merge
export const ripsMergeStart = () => {
    return {
        type: actionTypes.RIPS_MERGE_START
    };
};
// rips merge failed somehow
export const ripsMergeFail = (error) => {
    console.warn(error);
    return {
        type: actionTypes.RIPS_MERGE_FAIL,
        error: error
    };
};
// KICK OFF PROCESS - start merging rips clients
export const ripsMergeClients = (port, mData, clientNums) => {
    return dispatch => {
        // set mergeInProgress = true in port.js reducer
        dispatch(actions.startMerge());

        // call action indicating merge is starting
        dispatch(ripsMergeStart());

        console.log('Time to merge!', mData, clientNums);

        // if in development mode, port may not be available
        if (!port) {
            const errMsg = 'No Port available! Check connection & environment';
            dispatch(ripsMergeFail(errMsg));
            return;
        }

        // send message and data to background to begin merge
        port.postMessage({
            code: portCodes.RA_BKG_START_MERGE,
            data: mData,
            clientNums
        });

        // NOTE: data import actions are called
        // -> and handled in actions/port.js - via a port listener
    };
};