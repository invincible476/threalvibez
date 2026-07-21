import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'invincible476-patch-1',
  location: 'us-central1'
};

export const createUserRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateUser');
}
createUserRef.operationName = 'CreateUser';

export function createUser(dc) {
  return executeMutation(createUserRef(dc));
}

export const listSurveysRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSurveys');
}
listSurveysRef.operationName = 'ListSurveys';

export function listSurveys(dc) {
  return executeQuery(listSurveysRef(dc));
}

export const updateSurveyStatusRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSurveyStatus');
}
updateSurveyStatusRef.operationName = 'UpdateSurveyStatus';

export function updateSurveyStatus(dc) {
  return executeMutation(updateSurveyStatusRef(dc));
}

export const getSurveyRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSurvey');
}
getSurveyRef.operationName = 'GetSurvey';

export function getSurvey(dc) {
  return executeQuery(getSurveyRef(dc));
}

