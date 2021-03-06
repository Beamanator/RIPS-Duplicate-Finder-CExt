/*global chrome*/
import React, { Component, Fragment } from "react";
import { connect } from "react-redux";
import { withStyles } from "@material-ui/core/styles";

import CustomDialog from "./components/CustomDialog";
import CustomTable from "./components/CustomTable";

// material-ui core components
import {
    Button,
    Grid,
    Paper,
    TextField,
    DialogContentText,
    List,
    ListItem,
} from "@material-ui/core";

// redux store actions
import * as actions from "./store/actions";

// rips table config array
import { tableConfigs } from "./shared/ripsTableConfigHolder";

// rips page and field keys
import { RIPS_KEYS as R_KEYS } from "./shared/ripsKeys";

class App extends Component {
    state = {
        client1: process.env.NODE_ENV === "development" ? "201813794" : "",
        client2: process.env.NODE_ENV === "development" ? "201815032" : "",
        client3: process.env.NODE_ENV === "development" ? "201814527" : "",

        client1Valid: false,
        client2Valid: false,
        client3Valid: true, // valid cuz client3 can be empty

        // TODO: move import / mergeinprogress to redux, then have
        // port.js (BKG_RA_LOGIN_REMINDER - after opening dialog) call a new
        // action (in new action creator / reducer) to set import / merge to false.
        // If mergeInProgress is false, only import was happening so set
        // importInProgress to false. If mergeInProgres is true, set it to false.
        // TODO: now just remove these comments from this file :)
        // importInProgress: false,
        // mergeInProgress: false,
        nodeEnv: process.env.NODE_ENV,

        mergeDialogOpen: false,
        mergeDialogError: false,
        mergeDialogContent: "",

        /**
         * <tableKey>_AllSelected,
         * -> Boolean values describing when a table has all rows
         * -> selected.
         */
        /**
         * <tableKey>_SelectedArr,
         * -> Array of bools / integers (depending on table type)
         * -> depicting which rows are selected
         */
    };

    componentWillMount() {
        const { client1, client2, client3 } = this.state;
        const { bkgPort, onBackgroundPortInit } = this.props;

        // Warn user if we're in development environment
        if (process.env.NODE_ENV === "development") {
            console.warn(
                "Not initializing ports since we're only in " +
                    "dev mode (not inside a chrome extension)..."
            );
        }
        // Check if port exists. Set one up if not!
        else if (!bkgPort) {
            // begin port init
            onBackgroundPortInit(chrome);
        } else {
            console.warn("<Main> port already exists", bkgPort);
        }

        // initialize client#Valid state props
        const client1Valid = this.checkClientNumValid(client1);
        const client2Valid = this.checkClientNumValid(client2);
        const client3Valid = this.checkClientNumValid(client3, true);

        // update any values that need updating :)
        this.setState({ client1Valid, client2Valid, client3Valid });
    }

    checkClientNumValid = (numStr, emptyAllowed = false) => {
        if (emptyAllowed && numStr.length === 0) return true;

        // else (empty allowed but not empty, or empty not allowed)
        return (
            // test number is 9 digits
            /^[0-9]{9}$/.test(numStr) &&
            // test that first 2 digits are 20
            /^20/.test(numStr)
        );
    };
    onlyAllowNumbers = (str) =>
        str
            .replace(/o/gi, "0") // o / O => 0
            .replace(/[il]/gi, "1") // i / I / l / L => 1
            .replace(/[^0-9]/g, ""); // not 0-9 => '' (deleted)
    handleInputChange = (clientKey, event) => {
        // allow only client3 to be empty
        const allowEmpty = clientKey === "client3" ? true : false;

        // get client number from input change event
        let clientNum = event.target.value;
        // convert to numbers only
        clientNum = this.onlyAllowNumbers(clientNum);

        this.setState({
            [clientKey]: clientNum,
            [clientKey + "Valid"]: this.checkClientNumValid(
                clientNum,
                allowEmpty
            ),
        });
    };

    handleImportDisabled = () => {
        const { bkgPort, importInProgress } = this.props;
        const {
            client1Valid,
            client2Valid,
            client3Valid,
            nodeEnv,
        } = this.state;

        const importReady =
            // this condition SHOULD always
            // -> evaluate to false
            (nodeEnv !== "development" && !bkgPort) ||
            !client1Valid ||
            !client2Valid ||
            !client3Valid ||
            importInProgress;

        // KEEP! uncomment if values aren't what you'd expect!
        // console.warn('import disabled?', importReady);
        // console.info(
        //     'values:', nodeEnv, bkgPort, importInProgress,
        //     client1Valid, client2Valid, client3Valid
        // );

        return importReady;
    };

    handleImport = () => {
        console.log("Begin Import");

        const { bkgPort, onRipsFetchData, onImportStart } = this.props;

        // disable clicking import while import in progress
        onImportStart();

        // gather client nums into array
        const { client1, client2, client3 } = this.state;
        const clientNums = [client1, client2, client3];

        // call action to start fetching data from rips
        onRipsFetchData(bkgPort, clientNums);
    };

    handleClear = () => {
        const {
            bkgPort,
            onClearAllData,
            onImportStop,
            onMergeStop,
        } = this.props;

        // TODO: also clear rips data from redux store
        // -> including from bkg.js
        // Clear client nums, and reset client#Valid variables
        this.setState({
            client1: "",
            client1Valid: false,
            client2: "",
            client2Valid: false,
            client3: "",
            client3Valid: true,
            // importInProgress: false,
            // mergeInProgress: false
        });

        onImportStop();
        onMergeStop();
        onClearAllData(bkgPort);
    };

    handleMergeDialogOpen = () => {
        const {
            classes: { dialogListStyles },
        } = this.props;

        let mainDialogMessage =
            `If you're 100% sure you selected all ` +
            "of the correct client data that should be merged into one " +
            'RIPS record, select "Merge". IF YOU HAVE ANY QUESTIONS AT ' +
            "ALL, please talk to your coordinator or to the RIPS guy.";
        let mergeDialogError = false;
        let emptyTableNames = [];
        const emptyTablesMessage =
            "Warning: The following tables do " +
            "not have ALL rows selected, so there will be some data" +
            " LEFT OUT of the merge:";

        // Check if any files are selected on clients # 2 or 3.
        let filesNeedManualMove = false;
        // get files table selected array
        const filesSelected = this.state[R_KEYS.FILES + "_SelectedArr"];
        // loop through array, checking for selected cells
        filesSelected.forEach((fileSelectedRow) => {
            if (fileSelectedRow.length === 0) return;
            // loop through each row of data that could be selected
            fileSelectedRow.forEach((fileSelectedFlag, cIndex) => {
                // don't count first client -> this is the target, so
                // -> files won't need to be manually added here...
                // -> They're here already!
                if (cIndex === 0) return;
                // if client is not #1, and the file is selected, set
                // -> var to indicate files need to be manually moved!
                if (fileSelectedFlag) filesNeedManualMove = true;
            });
        });

        // if files need to be moved manually, update main message to
        // -> explain situation, and skip checking for empty tables
        // -> so we can present 1 error at a time.
        if (filesNeedManualMove) {
            mainDialogMessage =
                "ERROR: You selected at least 1 file " +
                "that needs to be moved to the target client (Client " +
                "#1). This merger cannot download & upload files, you " +
                "will need to do this manually. Please merge the files " +
                " manually, then come back and try again when you have " +
                "added the necessary files to the target client " +
                "(Client #1).";
            mergeDialogError = true;
        }
        // files don't need manual move, so now check if any tables
        // -> are empty!
        else {
            // loop through table keys [tableConfigs] and
            // -> add a note that mentions which tables are not totally
            // -> selected. User should think about closing the modal
            // -> and selecting some more values to be 100% accurate
            tableConfigs.forEach(({ key }) => {
                // match tableConfigs with state prop '<key>_AllSelected'
                if (!this.state[key + "_AllSelected"]) {
                    // state prop is false - so make sure we display
                    // -> table key warning below!
                    emptyTableNames.push(key);
                }
            });
        }

        // create some jsx - if there are some empty tables, display
        // -> them in a list w/ description. else, null!
        const newDialogContent = (
            <Fragment>
                <DialogContentText id="merge-dialog-description">
                    {mainDialogMessage}
                </DialogContentText>
                {/* If some tables are empty, add extra content */}
                {emptyTableNames.length > 0 ? (
                    <Fragment>
                        <br />
                        <DialogContentText>
                            {emptyTablesMessage}
                        </DialogContentText>
                        <List>
                            {emptyTableNames.map((name) => (
                                <ListItem
                                    key={name}
                                    className={dialogListStyles}
                                >
                                    {name}
                                </ListItem>
                            ))}
                        </List>
                    </Fragment>
                ) : null}
            </Fragment>
        );

        this.setState({
            mergeDialogOpen: true,
            mergeDialogError,
            mergeDialogContent: newDialogContent,
        });
    };
    handleMergeDialogClose = () => {
        this.setState({
            mergeDialogOpen: false,
        });
    };
    handleMergeDialogAgree = () => {
        const { onMergeBegin, bkgPort, ripsData } = this.props;
        const {
            client1,
            client2,
            client3,
            // [tableKey + '_SelectedArr'] extracted in loops
        } = this.state;

        // get 'mergeData' from 'ripsData' and
        // -> <tableKey>+'_SelectedArr's
        const mergeData = Object.entries(ripsData).reduce(
            (mData, [tableKey, tableArr]) => {
                // get table's associated selectedArr
                const selectedArr = this.state[tableKey + "_SelectedArr"];

                // if first element in 'selected' array is an Array, multiple
                // -> elements CAN be selected at the same time
                const multiSelect = Array.isArray(selectedArr[0]);

                // throw error if selectedArr and tableArr have different sizes
                if (selectedArr.length !== tableArr.length) {
                    console.error(
                        "WHY do selectedArr & tableArr have different lengths",
                        selectedArr,
                        tableArr
                    );
                    // Fail - not sure how to deal with this data
                    mData.pass = false;
                    return mData;
                }

                // if we're here, sizes are the same. Now loop through each row
                // -> and add the data back to mData (merged data)
                const arrToMerge = [];
                // multi-select logic
                if (multiSelect) {
                    const objToMerge = {};
                    tableArr.forEach(
                        ([fieldName, ...fieldData], fieldIndex) => {
                            // get array of selected fields indices from selectedArr
                            const selectedFieldIndices =
                                selectedArr[fieldIndex];

                            // if none selected, skip adding this field
                            if (selectedFieldIndices.length === 0) return;

                            // loop through selectedFieldIndices
                            selectedFieldIndices.forEach(
                                (isSelected, selectedIndex) => {
                                    // if field is selected (isSelected) and index > 0 (a.k.a.
                                    // -> client 2 or 3), add field to merge object :)
                                    if (isSelected && selectedIndex > 0) {
                                        const fieldValue =
                                            fieldData[selectedIndex];
                                        const groupIndex = fieldData[3];
                                        const clientIndex = selectedIndex;

                                        // create key to match up client data from different rows
                                        const dataMatchKey = `${clientIndex}-${groupIndex}`;
                                        if (!objToMerge[dataMatchKey]) {
                                            objToMerge[dataMatchKey] = {};
                                        }

                                        // get rid of fieldName group #
                                        // -> ex: '13. date' -> 'date'
                                        const firstSpaceLoc = fieldName.indexOf(
                                            " "
                                        );
                                        const basicFieldName = fieldName.substr(
                                            firstSpaceLoc + 1
                                        );

                                        // assign data to matching data key
                                        objToMerge[dataMatchKey][
                                            basicFieldName
                                        ] = fieldValue;
                                    }
                                    // else, not selected - do nothing
                                    else {
                                    }
                                }
                            );
                        }
                    );
                    // add all data objects to the merge array!
                    Object.entries(objToMerge).forEach(([_, dataObj]) => {
                        arrToMerge.push(dataObj);
                    });
                }

                // single-select logic
                else {
                    tableArr.forEach(
                        ([fieldName, ...fieldData], fieldIndex) => {
                            // get selectedIndex from selectedArr
                            const selectedIndex = selectedArr[fieldIndex];

                            // if none OR first elem selected, skip adding this field
                            // -> (first col = client 1, so already set on target client
                            // -> [client #1] and doesn't need to be added again)
                            if (selectedIndex === null || selectedIndex === 0)
                                return;

                            // add selected field to array to merge
                            arrToMerge.push({
                                [fieldName]: fieldData[selectedIndex],
                            });
                        }
                    );
                }

                // add prop (table key) if doesn't exist
                if (!mData[tableKey]) mData[tableKey] = [];

                // merge all objects in arrToMerge into mData
                arrToMerge.forEach((fieldObj) => {
                    // push data to big merge container object!
                    mData[tableKey].push(fieldObj);
                });

                return mData;
            },
            { pass: true }
        );

        // close dialog
        this.handleMergeDialogClose();

        // throw error if data merge didn't work perfectly
        if (!mergeData.pass) {
            // TODO: add notification or something here
            console.error("error somewhere");
            return;
        }

        // pass data to action
        onMergeBegin(
            bkgPort,
            mergeData, // pass mergeData here!
            // [target num, ...other nums]
            [client1, client2, client3]
        );

        // TODO: remove
        // lock tables, disable merge button
        // this.setState({ mergeInProgress: true });
    };
    handleNotifyDialogClose = () => {
        this.props.onNotifyDialogClose();
    };

    handleError = (msg, type = "error") => {
        // TODO: display these errors / warnings somewhere?
        if (!["error", "warn", "info"].includes(type)) {
            console.error(
                `[handleError] has error! What is error` + ` type <${type}>`
            );
        } else {
            console[type](msg);
        }
    };
    handleCellSelected = (tableKey, isAllSelected, selectedArr) => {
        this.setState({
            [tableKey + "_SelectedArr"]: selectedArr,
            [tableKey + "_AllSelected"]: isAllSelected,
        });
    };

    buildGridTable = (config, tableIndex) => {
        const { key, title, type = "basic", multiSelect = false } = config;

        const { classes, ripsData, mergeInProgress } = this.props;
        const { client1, client2, client3, client3Valid } = this.state;

        // if data exists, build grid item!
        if (ripsData[key]) {
            return (
                <Grid item xs={12} className={classes.textCenter} key={title}>
                    <CustomTable
                        cellSelectHandler={this.handleCellSelected}
                        clientNums={[client1, client2, client3]}
                        data={ripsData[key]}
                        errorHandler={this.handleError}
                        locked={mergeInProgress}
                        multiSelect={multiSelect}
                        numCols={client3 && client3Valid ? 3 : 2}
                        tableKey={key}
                        title={title}
                        type={type}
                    />
                </Grid>
            );
        }
        // otherwise, just return nothing
        else return null;
    };

    render() {
        const {
            classes, // styles
            // bkgPort, // port to background page
            ripsData, // data from RIPS
            importInProgress,
            mergeInProgress,
        } = this.props;

        const {
            client1,
            client2,
            client3,
            // importInProgress,
            // mergeInProgress,

            mergeDialogOpen,
            mergeDialogError,
            mergeDialogContent,
        } = this.state;

        const {
            notifyDialogOpen,
            notifyDialogTitle,
            notifyDialogShowActionButton,
            notifyDialogButtonActionText,
            notifyDialogButtonCloseText,
            notifyDialogContent,
        } = this.props;

        const RIPS_URL = "https://rips.247lib.com/Stars/User/Login";

        return (
            <Fragment>
                <Grid
                    container
                    className={classes.root}
                    // note: padding added in parent (in index.js) to make
                    // -> spacing not cause issues in the Grid component
                    spacing={16}
                >
                    {/* Title */}
                    <Grid item xs={12} className={classes.textCenter}>
                        <h1>{'Welcome to "The Merger"!'}</h1>
                    </Grid>

                    {/* Input elements - StARS #s*/}
                    <Grid item xs={12} className={classes.textCenter}>
                        <h3>{"Enter StARS #s for each client below:"}</h3>
                        <Paper className={classes.clientNumContainer}>
                            <Grid container justify="center" spacing={40}>
                                <Grid item xs={3}>
                                    <TextField
                                        disabled={importInProgress}
                                        id="client1"
                                        label="Client StARS #1"
                                        className={classes.textField}
                                        value={client1}
                                        onChange={(event) =>
                                            this.handleInputChange(
                                                "client1",
                                                event
                                            )
                                        }
                                    />
                                </Grid>
                                <Grid item xs={3}>
                                    <TextField
                                        disabled={importInProgress}
                                        id="client2"
                                        label="Client StARS #2"
                                        className={classes.textField}
                                        value={client2}
                                        onChange={(event) =>
                                            this.handleInputChange(
                                                "client2",
                                                event
                                            )
                                        }
                                    />
                                </Grid>
                                <Grid item xs={3}>
                                    <TextField
                                        disabled={importInProgress}
                                        id="client3"
                                        label="Client StARS #3"
                                        className={classes.textField}
                                        value={client3}
                                        onChange={(event) =>
                                            this.handleInputChange(
                                                "client3",
                                                event
                                            )
                                        }
                                    />
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Pre-import instructions */}
                    {!importInProgress ? (
                        <Grid item xs={12} className={classes.textCenter}>
                            <h1>
                                {"Before beginning, open "}
                                <a
                                    href={RIPS_URL}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    RIPS
                                </a>
                            </h1>
                            <h4 className={classes.description}>
                                {"If you don't have RIPS open yet, " +
                                    "click this link to open it up and sign in: "}
                                <a
                                    href={RIPS_URL}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    Open RIPS
                                </a>
                            </h4>
                        </Grid>
                    ) : null}

                    {/* "import" / "clear" buttons - begin collecting data or clear! */}
                    <Grid item xs={12} className={classes.textCenter}>
                        <Grid container justify="center">
                            <Grid item xs={2}>
                                <Button
                                    color="primary"
                                    className={classes.button}
                                    variant="contained"
                                    size="large"
                                    disabled={this.handleImportDisabled()}
                                    onClick={this.handleImport}
                                >
                                    {"Import"}
                                </Button>
                            </Grid>
                            <Grid item xs={2}>
                                <Button
                                    color="secondary"
                                    className={classes.button}
                                    variant="contained"
                                    size="large"
                                    onClick={this.handleClear}
                                >
                                    {"Clear"}
                                </Button>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Post-import instructions */}
                    {ripsData && Object.keys(ripsData).length > 0 ? (
                        <Grid item xs={12} className={classes.textCenter}>
                            <h1>{'Select the "correct" client data below!'}</h1>
                            <h4 className={classes.description}>
                                {"Each table below shows data that is inconsistent " +
                                    "between client records. Therefore, please select " +
                                    "a cell in each row that shows the accurate data " +
                                    "for that field."}
                            </h4>
                            <h4 className={classes.description}>
                                {"----------------------------------"}
                            </h4>
                            <h4 className={classes.description}>
                                {"Example: If the Date of Birth field is shown below, " +
                                    "that means the clients entered have different Dates of " +
                                    "Birth saved in their RIPS record. Select the " +
                                    "correct Date of Birth that should be saved in the " +
                                    "merged record."}
                            </h4>
                            <h4 className={classes.description}>
                                {"----------------------------------"}
                            </h4>
                            <h4 className={classes.description}>
                                {"NOTE: All of the data you select below will be " +
                                    "merged into the RIPS record for Client #1. Therefore, " +
                                    "you should make sure that the StARS number you enter " +
                                    "for Client #1 is the record with the most actions " +
                                    "and / or the most accurate data. Please contact " +
                                    "'the RIPS Guy' if you have questions!"}
                            </h4>
                        </Grid>
                    ) : null}

                    {/* Build all data tables :) */}
                    {tableConfigs.map((tableConfig, tableIndex) => {
                        return this.buildGridTable(tableConfig, tableIndex);
                    })}

                    {/* "Merge" button - begin RIPS merge! */}
                    {ripsData && Object.keys(ripsData).length > 0 ? (
                        <Grid item xs={12} className={classes.textCenter}>
                            <Grid container justify="center">
                                <div
                                    className={classes.dialogDescriptionPadding}
                                >
                                    <h4 className={classes.description}>
                                        {"When you're ready to merge two (or three) client records " +
                                            "in RIPS, make sure you've selected all of the data " +
                                            "you want to be saved in the final record! You'll see " +
                                            "all green boxes in the 'Field Names' column when " +
                                            "there's no forgotten data."}
                                    </h4>
                                    <h4 className={classes.description}>
                                        {"----------------------------------"}
                                    </h4>
                                    <h4 className={classes.description}>
                                        {"Finally, just press 'Merge' below!"}
                                    </h4>
                                </div>

                                <Grid item xs={4}>
                                    <Button
                                        color="secondary"
                                        className={classes.button}
                                        variant="contained"
                                        size="large"
                                        onClick={this.handleMergeDialogOpen}
                                        disabled={mergeInProgress}
                                    >
                                        {"Merge"}
                                    </Button>
                                </Grid>
                            </Grid>
                        </Grid>
                    ) : null}
                </Grid>

                {/* "Merge" dialog! */}
                <CustomDialog
                    isOpen={mergeDialogOpen}
                    handleClose={this.handleMergeDialogClose}
                    title={"Are you sure you're ready to merge?"}
                    buttonCloseText={"Take me back"}
                    showActionButton={!mergeDialogError}
                    buttonActionText={"Merge"}
                    buttonActionFunction={this.handleMergeDialogAgree}
                >
                    {mergeDialogContent}
                </CustomDialog>

                {/* Notification dialog! */}
                <CustomDialog
                    isOpen={notifyDialogOpen}
                    handleClose={this.handleNotifyDialogClose}
                    title={notifyDialogTitle}
                    buttonCloseText={notifyDialogButtonCloseText}
                    buttonActionText={notifyDialogButtonActionText}
                    showActionButton={notifyDialogShowActionButton}
                >
                    <DialogContentText>{notifyDialogContent}</DialogContentText>
                </CustomDialog>
            </Fragment>
        );
    }
}

// set up styles
const styles = (theme) => ({
    root: {
        flexGrow: 1,
    },
    textCenter: {
        textAlign: "center",
    },
    button: {
        margin: theme.spacing.unit,
    },
    // header styles
    header: {
        padding: "1px 0px", // gives it some volume somehow
    },
    // input element styles
    clientNumContainer: {
        padding: "10px 0 20px 0",
    },
    // text-area (input) styles
    textField: {
        marginLeft: theme.spacing.unit,
        marginRight: theme.spacing.unit,
        width: 200,
    },
    // description sections
    description: {
        margin: "0 25%",
    },
    dialogDescriptionPadding: {
        padding: "20px",
    },
    dialogListStyles: {
        paddingTop: "4px",
        paddingBottom: "4px",
        color: "#e53935",
        fontWeight: "bold",
    },
});

const mapStateToProps = ({ port, rips, notifyDialog }) => {
    return {
        // TODO: isAuthenticated...
        bkgPort: port.port,
        importInProgress: port.importInProgress,
        mergeInProgres: port.importInProgress,
        ripsData: rips.data,
        // data for notify dialog box
        notifyDialogOpen: notifyDialog.open,
        notifyDialogTitle: notifyDialog.title,
        notifyDialogShowActionButton: notifyDialog.showActionButton,
        notifyDialogButtonActionText: notifyDialog.buttonActionText,
        notifyDialogButtonCloseText: notifyDialog.buttonCloseText,
        notifyDialogContent: notifyDialog.dialogContent,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onBackgroundPortInit: (chrome) =>
            dispatch(actions.backgroundPortInit(chrome)),
        onClearAllData: (bkgPort) =>
            dispatch(actions.ripsClearAllData(bkgPort)),
        onImportStart: () => dispatch(actions.startImport()),
        onImportStop: () => dispatch(actions.stopImport()),
        // onMergeStart: // called within onMergeBegin! Not here.
        onMergeBegin: (bkgPort, mData, cNums) =>
            dispatch(actions.ripsMergeClients(bkgPort, mData, cNums)),
        onMergeStop: () => dispatch(actions.stopMerge()),
        onRipsFetchData: (bkgPort, nums) =>
            dispatch(actions.ripsFetchData(bkgPort, nums)),
        onNotifyDialogClose: () => dispatch(actions.notifyDialogClose()),
        onNotifyDialogOpenNew: (config) =>
            dispatch(actions.notifyDialogOpenNew(config)),
    };
};

// Option 2: use package 'recompose' to export withstyles & connect
// https://github.com/acdlite/recompose
// https://stackoverflow.com/questions/45704681/react-material-ui-export-multiple-higher-order-components
export default connect(
    mapStateToProps,
    mapDispatchToProps
)(withStyles(styles)(App));
