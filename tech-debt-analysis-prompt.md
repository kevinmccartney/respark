Ok we are going to start evaluating things we can clean up in the existing projects. Look at the api project & generate a report of changes that could improve the codebase. We are mainly looking for

- Repetition
- Overly complex logic
- Large functions/god object ("high gravity"/highly coupled areas)
- Lack of type safety
- Assumptions about inputs that may be incorrect or overly defensive

I can tell you one thing I will probably want is to implement Zod @api
