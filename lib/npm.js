import fs from "fs";
import path from "path";

function findAllPackageJsons(startDir) {
  const packageJsons = [];
  let currentDir = path.resolve(startDir);
  try {
    while (currentDir !== path.parse(currentDir).root) {
      const packageJsonPath = path.join(currentDir, "package.json");
      try {
        // Attempt to read the file (throws if not readable or not present)
        const doesExist = fs.existsSync(packageJsonPath);
        if (doesExist) {
          packageJsons.push(packageJsonPath);
        }
      } catch (error) {
        console.error(error);
        return packageJsons;
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }
  } catch (error) {
    // Handle any unexpected error during directory traversal
    console.error("Error during directory traversal:", error.message);
    return packageJsons;
  }

  return packageJsons;
}

export function findRootPackageJson(startDir) {
  const packageJsons = findAllPackageJsons(startDir);
  return packageJsons.length > 0 ? packageJsons[packageJsons.length - 1] : null;
}

export function matchWorkspace(workspacePath,rootDirectoryPath, targetPath) {
  const normalizedWorkspacePath = path.resolve(rootDirectoryPath,workspacePath);
  const normalizedDirectoryPath = path.resolve(targetPath);
  

  if (normalizedWorkspacePath.includes('*')) {
    const workspacePathArray = normalizedWorkspacePath.split(path.sep);
    const directoryPathArray = normalizedDirectoryPath.split(path.sep);

    for (let index = 0; index < workspacePathArray.length; index++) {
      const workspaceSegment = workspacePathArray[index];
      const targetSegment = typeof directoryPathArray[index] !== 'undefined' ? directoryPathArray[index] : null;
      
      if (workspaceSegment === '*'){
        if (targetSegment !== null){
          return directoryPathArray.slice(0,index + 1).join(path.sep);
        }
        return null;
      } else {
        if (workspaceSegment !== targetSegment){
          return null;
        }
        continue
      }
    }
    return null;
  } else {
    // If no asterisk, simply check if the directory path is the same or is a subdirectory
    return normalizedDirectoryPath.startsWith(normalizedWorkspacePath) ? normalizedWorkspacePath : null;
  }
}

export function getWorkspaceDirectory(context){
  const logger = context.logger;
  const rootPackageJsonPath = findRootPackageJson(context.cwd);
  if (!rootPackageJsonPath){
    return null;
  }
  const rootDirectory = path.dirname(rootPackageJsonPath);
  const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath));


  if (!Array.isArray(rootPackageJson.workspaces)){
    logger.warn(`Root package json does not have workspaces property`);
    return null;
  }
  for (const workspace of rootPackageJson.workspaces) {
    const matched = matchWorkspace(workspace,rootDirectory,context.cwd);
    if (matched){
      return matched;
    }
  }
  return null;
}


export function filterCommitsByWorkspace(workspaceRoot, gitDirectory, commits){
  if (!Array.isArray(commits)){
    throw new Error('Commit list needs to be an array.'+ typeof commits + ' found.');
  }
  return commits.filter(commit => {
      return commit.files.some(file => {
        const absolutePath = path.resolve(gitDirectory,file.path);
        return absolutePath.startsWith(workspaceRoot);
      });
    });
}