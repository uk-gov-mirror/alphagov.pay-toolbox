// import { Request, Response, NextFunction } from 'express'
import { IsString, IsPhoneNumber, IsMobilePhone, IsNotEmpty, IsEmail } from 'class-validator'

import { wrapAsyncErrorHandlers } from '../../../lib/routes'
import { AdminUsers } from '../../../lib/pay-request'
import Validated from '../common/validated'

import { formatErrorsForTemplate, ClientFormError } from '../common/validationErrorFormat'
import { IOValidationError, RESTClientError } from '../../../lib/errors';

const truncate = function truncate(value: string, length: number): string {
  return `${value.substr(0, length)}...`
}

// @TODO(sfount) move to template
// eslint-disable-next-line arrow-body-style
const formatServiceRoles = (user: any, serviceRoles: any): any => {
  // eslint-disable-next-line arrow-body-style
  return serviceRoles.map((role: any) => {
    return {
      key: { text: role.service.name },
      value: { html: `<code>${role.service.external_id}</code` },
      actions: { items: [ { href: `/users/${user.external_id }/service/${role.service.external_id}/delete`, text: 'Remove user' } ] }
    }
  })
}

// req: Request
// res: Response
const show = async function show(req: any, res: any): Promise<void> {
  const payUser = await AdminUsers.user(req.params.id)
  const context: any = { payUser, format: { serviceRoles: formatServiceRoles }, messages: req.flash('info'), _csrf: req.csrfToken() }

  res.render('users/users.show.njk', context)
}

const updatePhoneNumberForm = async function updatePhoneNumberForm(req: any, res: any): Promise<void> {
  const user = await AdminUsers.user(req.params.id)
  const context: any = { user, csrf: req.csrfToken() }
  const { recovered } = req.session

  // @TODO(sfount) move all recovery code into one place -- all mapping to formats the template
  //               understand should be done in one place
  if (recovered) {
    context.formValues = recovered.formValues

    if (recovered.errors) {
      context.errors = recovered.errors
      context.errorMap = recovered.errors.reduce((aggregate: {
        [key: string]: string;
      }, error: ClientFormError) => {
        // eslint-disable-next-line no-param-reassign
        aggregate[error.id] = error.message
        return aggregate
      }, {})
    }
    delete req.session.recovered
  }
  res.render('users/users.update_phone.njk', context)
}

const updateEmailForm = async function updateEmailForm(req: any, res: any): Promise<void> {
  const user = await AdminUsers.user(req.params.id)
  const context: any = { user, csrf: req.csrfToken() }
  const { recovered } = req.session

  // @TODO(sfount) move all recovery code into one place -- all mapping to formats the template
  //               understand should be done in one place
  if (recovered) {
    context.formValues = recovered.formValues

    if (recovered.errors) {
      context.errors = recovered.errors
      context.errorMap = recovered.errors.reduce((aggregate: {
        [key: string]: string;
      }, error: ClientFormError) => {
        // eslint-disable-next-line no-param-reassign
        aggregate[error.id] = error.message
        return aggregate
      }, {})
    }
    delete req.session.recovered
  }
  res.render('users/users.update_email.njk', context)
}

class EmailRequest extends Validated {
  @IsEmail({}, { message: 'Provided value must be a valid email' })
  @IsNotEmpty()
  @IsString()
  public email: string;

  public constructor(formValues: {[key: string]: string}) {
    super()
    this.email = formValues.email
    this.validate()
  }
}

class PhoneNumberRequest extends Validated {
  @IsPhoneNumber('ZZ', { message: 'User telephone number must be a valid international phone number' })
  @IsNotEmpty()
  @IsString()
  public telephone_number: string;

  public constructor(formValues: {[key: string]: string}) {
    super()
    this.telephone_number = formValues.telephone_number
    this.validate()
  }
}

const updateEmail = async function updateEmail(req: any, res: any, next: any): Promise<void> {
  const id = req.params.id

  try {
    const updateRequest = new EmailRequest(req.body)

    const result = await AdminUsers.updateUserEmail(id, updateRequest.email)
    req.flash('info', 'Updated phone number ')
    res.redirect(`/users/${id}`)
  } catch (error) {
    let errors
    if (error instanceof IOValidationError) {
      req.session.recovered = {
        formValues: req.body,
        errors: formatErrorsForTemplate(error.source)
      }
      res.redirect(`/users/${id}/email`)
      return
    }
    next(error)
  }
}

const updatePhoneNumber = async function updatePhoneNumber(req: any, res: any, next: any): Promise<void> {
  const id = req.params.id

  try {
    const updateRequest = new PhoneNumberRequest(req.body)

    const result = await AdminUsers.updateUserPhone(id, updateRequest.telephone_number)
    req.flash('info', 'Updated phone number ')
    res.redirect(`/users/${id}`)
  } catch (error) {
    let errors
    if (error instanceof IOValidationError) {
      req.session.recovered = {
        formValues: req.body,
        errors: formatErrorsForTemplate(error.source)
      }
      res.redirect(`/users/${id}/phone`)
      return
    }
    next(error)
  }
}

const toggleUserEnabled = async function toggleUserEnabled(req: any, res: any, next: any): Promise<void> {
  const id = req.params.id
  const result = await AdminUsers.toggleUserEnabled(id)

  req.flash('info', 'Updated disabled status')
  res.redirect(`/users/${id}`)
}

const removeUserFromService = async function removeUserFromService(req: any, res: any, next: any): Promise<void> {
  const { serviceId, userId } = req.params
  const result = await AdminUsers.removeUserFromService(serviceId, userId)

  req.flash('info', `User ${userId} removed from service ${serviceId}`)
  res.redirect(`/users/${userId}`)
}

const resetUserSecondFactor = async function resetUserSecondFactor(req: any, res: any, next: any): Promise<void> {
  const { id } = req.params
  const result = await AdminUsers.resetUserSecondFactor(id)

  req.flash('info', 'User second factor method reset')
  res.redirect(`/users/${id}`)
}

// @TODO(sfount) use individual wrapAsyncErrorHandler
export default wrapAsyncErrorHandlers({ show, updatePhoneNumber, updatePhoneNumberForm, updateEmailForm, updateEmail, toggleUserEnabled, removeUserFromService, resetUserSecondFactor })