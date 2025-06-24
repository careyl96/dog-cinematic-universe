import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator'

export const IsGuildIdRequired = (validationOptions?: ValidationOptions) => {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isGuildIdRequired',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any
          if (obj.public === true && (!value || typeof value !== 'string')) {
            return false
          }
          return true
        },
        defaultMessage(args: ValidationArguments) {
          return `guildId is required when playlist is public`
        },
      },
    })
  }
}
