const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'invincible476-patch-1',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const createUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser');
}
createUserRef.operationName = 'CreateUser';
exports.createUserRef = createUserRef;

exports.createUser = function createUser(dc) {
  return executeMutation(createUserRef(dc));
};

const listSurveysRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSurveys');
}
listSurveysRef.operationName = 'ListSurveys';
exports.listSurveysRef = listSurveysRef;

exports.listSurveys = function listSurveys(dc) {
  return executeQuery(listSurveysRef(dc));
};

const updateSurveyStatusRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSurveyStatus');
}
updateSurveyStatusRef.operationName = 'UpdateSurveyStatus';
exports.updateSurveyStatusRef = updateSurveyStatusRef;

exports.updateSurveyStatus = function updateSurveyStatus(dc) {
  return executeMutation(updateSurveyStatusRef(dc));
};

const getSurveyRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSurvey');
}
getSurveyRef.operationName = 'GetSurvey';
exports.getSurveyRef = getSurveyRef;

exports.getSurvey = function getSurvey(dc) {
  return executeQuery(getSurveyRef(dc));
};
