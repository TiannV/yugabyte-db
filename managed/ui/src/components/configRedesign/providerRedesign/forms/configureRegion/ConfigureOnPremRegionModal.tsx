/*
 * Copyright 2023 YugaByte, Inc. and Contributors
 * Licensed under the Polyform Free Trial License 1.0.0 (the "License")
 * You may not use this file except in compliance with the License. You may obtain a copy of the License at
 * http://github.com/YugaByte/yugabyte-db/blob/master/licenses/POLYFORM-FREE-TRIAL-LICENSE-1.0.0.txt
 */

import React from 'react';
import clsx from 'clsx';
import { FormHelperText, makeStyles } from '@material-ui/core';
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form';
import { array, object, string } from 'yup';
import { v4 as uuidv4 } from 'uuid';
import { yupResolver } from '@hookform/resolvers/yup';

import { YBInputField, YBModal, YBModalProps } from '../../../../../redesign/components';
import { OnPremRegionFieldLabel } from './constants';
import { ConfigureOnPremAvailabilityZoneField } from './ConfigureOnPremAvailabilityZoneField';

interface ConfigureOnPremRegionModalProps extends YBModalProps {
  onRegionSubmit: (region: ConfigureOnPremRegionFormValues) => void;
  onClose: () => void;

  regionSelection?: ConfigureOnPremRegionFormValues;
}

export interface ConfigureOnPremRegionFormValues {
  fieldId: string;
  code: string;
  zones: { code: string }[];
}

const useStyles = makeStyles((theme) => ({
  titleIcon: {
    color: theme.palette.orange[500]
  },
  formField: {
    marginTop: theme.spacing(1),
    '&:first-child': {
      marginTop: 0
    }
  },
  manageAvailabilityZoneField: {
    marginTop: theme.spacing(1)
  }
}));

export const ConfigureOnPremRegionModal = ({
  onRegionSubmit,
  onClose,
  regionSelection,
  ...modalProps
}: ConfigureOnPremRegionModalProps) => {
  const validationSchema = object().shape({
    code: string().required(`${OnPremRegionFieldLabel.CODE} is required.`),
    zones: array().min(1, 'Region configurations must contain at least one zone.')
  });
  const formMethods = useForm<ConfigureOnPremRegionFormValues>({
    defaultValues: regionSelection,
    resolver: yupResolver(validationSchema)
  });
  const classes = useStyles();

  const onSubmit: SubmitHandler<ConfigureOnPremRegionFormValues> = (formValues) => {
    const newRegion = {
      ...formValues,
      fieldId: formValues.fieldId ?? uuidv4()
    };
    onRegionSubmit(newRegion);
    formMethods.reset();
    onClose();
  };

  return (
    <FormProvider {...formMethods}>
      <YBModal
        title="Add Region"
        titleIcon={<i className={clsx('fa fa-plus', classes.titleIcon)} />}
        submitLabel="Add Region"
        cancelLabel="Cancel"
        onSubmit={formMethods.handleSubmit(onSubmit)}
        onClose={onClose}
        {...modalProps}
      >
        <div className={classes.formField}>
          <div>{OnPremRegionFieldLabel.CODE}</div>
          <YBInputField
            control={formMethods.control}
            name="code"
            placeholder="Enter..."
            fullWidth
          />
        </div>
        <div>
          <ConfigureOnPremAvailabilityZoneField
            className={classes.manageAvailabilityZoneField}
            isSubmitting={formMethods.formState.isSubmitting}
          />
          {formMethods.formState.errors.zones?.message && (
            <FormHelperText error={true}>
              {formMethods.formState.errors.zones?.message}
            </FormHelperText>
          )}
        </div>
      </YBModal>
    </FormProvider>
  );
};