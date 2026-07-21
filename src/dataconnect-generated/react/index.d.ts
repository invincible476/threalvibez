import { CreateUserData, ListSurveysData, UpdateSurveyStatusData, GetSurveyData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, void>): UseDataConnectMutationResult<CreateUserData, undefined>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, void>): UseDataConnectMutationResult<CreateUserData, undefined>;

export function useListSurveys(options?: useDataConnectQueryOptions<ListSurveysData>): UseDataConnectQueryResult<ListSurveysData, undefined>;
export function useListSurveys(dc: DataConnect, options?: useDataConnectQueryOptions<ListSurveysData>): UseDataConnectQueryResult<ListSurveysData, undefined>;

export function useUpdateSurveyStatus(options?: useDataConnectMutationOptions<UpdateSurveyStatusData, FirebaseError, void>): UseDataConnectMutationResult<UpdateSurveyStatusData, undefined>;
export function useUpdateSurveyStatus(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSurveyStatusData, FirebaseError, void>): UseDataConnectMutationResult<UpdateSurveyStatusData, undefined>;

export function useGetSurvey(options?: useDataConnectQueryOptions<GetSurveyData>): UseDataConnectQueryResult<GetSurveyData, undefined>;
export function useGetSurvey(dc: DataConnect, options?: useDataConnectQueryOptions<GetSurveyData>): UseDataConnectQueryResult<GetSurveyData, undefined>;
