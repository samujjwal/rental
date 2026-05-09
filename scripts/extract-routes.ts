import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

interface RouteMetadata {
  controller: string;
  path: string;
  method: string;
  handler: string;
  guards: string[];
  decorators: string[];
  summary?: string;
  description?: string;
}

const controllerDir = join(__dirname, '../apps/api/src');

function findControllers(dir: string, controllers: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findControllers(fullPath, controllers);
    } else if (file.endsWith('.controller.ts')) {
      controllers.push(fullPath);
    }
  }
  return controllers;
}

function extractRoutesFromFile(filePath: string): RouteMetadata[] {
  const sourceCode = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
  const routes: RouteMetadata[] = [];
  let currentController = '';
  let basePath = '';

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      currentController = node.name.text;
      // Find @Controller decorator
      for (const decorator of node.decorators || []) {
        if (ts.isCallExpression(decorator.expression)) {
          const decoratorName = decorator.expression.expression.getText();
          if (decoratorName === 'Controller') {
            const arg = decorator.expression.arguments[0];
            if (arg && ts.isStringLiteral(arg)) {
              basePath = arg.text;
            }
          }
        }
      }
    }

    if (ts.isMethodDeclaration(node) && node.name) {
      const methodName = node.name.text;
      let httpMethod = '';
      let routePath = basePath;
      const guards: string[] = [];
      const decorators: string[] = [];
      let summary: string | undefined;
      let description: string | undefined;

      for (const decorator of node.decorators || []) {
        if (ts.isCallExpression(decorator.expression)) {
          const decoratorName = decorator.expression.expression.getText();
          decorators.push(decoratorName);

          if (['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head'].includes(decoratorName)) {
            httpMethod = decoratorName.toLowerCase();
            const arg = decorator.expression.arguments[0];
            if (arg && ts.isStringLiteral(arg)) {
              routePath = basePath + arg.text;
            }
          }

          if (decoratorName === 'ApiOperation') {
            const arg0 = decorator.expression.arguments[0];
            if (arg0 && ts.isObjectLiteralExpression(arg0)) {
              for (const prop of arg0.properties) {
                if (ts.isPropertyAssignment(prop) && prop.name.getText() === 'summary') {
                  if (ts.isStringLiteral(prop.initializer)) {
                    summary = prop.initializer.text;
                  }
                }
                if (ts.isPropertyAssignment(prop) && prop.name.getText() === 'description') {
                  if (ts.isStringLiteral(prop.initializer)) {
                    description = prop.initializer.text;
                  }
                }
              }
            }
          }

          if (decoratorName === 'UseGuards') {
            const args = decorator.expression.arguments;
            for (const arg of args) {
              if (ts.isIdentifier(arg)) {
                guards.push(arg.text);
              }
            }
          }
        }
      }

      if (httpMethod) {
        routes.push({
          controller: currentController,
          path: routePath,
          method: httpMethod,
          handler: methodName,
          guards,
          decorators,
          summary,
          description,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return routes;
}

function main() {
  const controllerFiles = findControllers(controllerDir);
  console.log(`Found ${controllerFiles.length} controller files`);

  const allRoutes: RouteMetadata[] = [];

  for (const file of controllerFiles) {
    const routes = extractRoutesFromFile(file);
    allRoutes.push(...routes);
  }

  console.log(`\nExtracted ${allRoutes.length} routes\n`);
  console.log(JSON.stringify(allRoutes, null, 2));
}

main();
