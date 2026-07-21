import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Answer_Key {
  id: UUIDString;
  __typename?: 'Answer_Key';
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface GetSurveyData {
  survey?: {
    id: UUIDString;
    title: string;
    description?: string | null;
    questions_on_survey: ({
      id: UUIDString;
      text: string;
      order: number;
    } & Question_Key)[];
  } & Survey_Key;
}

export interface ListSurveysData {
  surveys: ({
    id: UUIDString;
    title: string;
    description?: string | null;
  } & Survey_Key)[];
}

export interface Question_Key {
  id: UUIDString;
  __typename?: 'Question_Key';
}

export interface Response_Key {
  id: UUIDString;
  __typename?: 'Response_Key';
}

export interface Survey_Key {
  id: UUIDString;
  __typename?: 'Survey_Key';
}

export interface UpdateSurveyStatusData {
  survey_update?: Survey_Key | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(): MutationPromise<CreateUserData, undefined>;
export function createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface ListSurveysRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSurveysData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListSurveysData, undefined>;
  operationName: string;
}
export const listSurveysRef: ListSurveysRef;

export function listSurveys(): QueryPromise<ListSurveysData, undefined>;
export function listSurveys(dc: DataConnect): QueryPromise<ListSurveysData, undefined>;

interface UpdateSurveyStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<UpdateSurveyStatusData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<UpdateSurveyStatusData, undefined>;
  operationName: string;
}
export const updateSurveyStatusRef: UpdateSurveyStatusRef;

export function updateSurveyStatus(): MutationPromise<UpdateSurveyStatusData, undefined>;
export function updateSurveyStatus(dc: DataConnect): MutationPromise<UpdateSurveyStatusData, undefined>;

interface GetSurveyRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSurveyData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSurveyData, undefined>;
  operationName: string;
}
export const getSurveyRef: GetSurveyRef;

export function getSurvey(): QueryPromise<GetSurveyData, undefined>;
export function getSurvey(dc: DataConnect): QueryPromise<GetSurveyData, undefined>;

