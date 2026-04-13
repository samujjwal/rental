/**
 * API Versioning Service
 * 
 * Manages API versioning, lifecycle, and compatibility
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ApiVersionInfo,
  ApiChange,
  ApiContract,
  ContractDocumentation,
} from '../interfaces/api-contract.interface';

@Injectable()
export class ApiVersioningService {
  private readonly logger = new Logger(ApiVersioningService.name);
  private versions = new Map<string, ApiVersionInfo>();
  private currentVersion: string = '1.0.0';
  private deprecatedVersions: Set<string> = new Set();
  private sunsetVersions: Set<string> = new Set();
  private contracts = new Map<string, ApiContract[]>();
  private documentation = new Map<string, ContractDocumentation>();

  registerVersion(versionInfo: ApiVersionInfo): void {
    this.versions.set(versionInfo.version, versionInfo);

    if (versionInfo.status === 'deprecated') {
      this.deprecatedVersions.add(versionInfo.version);
    }

    if (versionInfo.status === 'sunset') {
      this.sunsetVersions.add(versionInfo.version);
    }

    this.logger.log(`Registered API version: ${versionInfo.version} (${versionInfo.status})`);
  }

  getVersion(version: string): ApiVersionInfo | undefined {
    return this.versions.get(version);
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  setCurrentVersion(version: string): void {
    if (!this.versions.has(version)) {
      throw new Error(`Version ${version} is not registered`);
    }
    this.currentVersion = version;
    this.logger.log(`Current API version set to: ${version}`);
  }

  isVersionSupported(version: string): boolean {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) return false;

    return versionInfo.status !== 'sunset';
  }

  isVersionDeprecated(version: string): boolean {
    return this.deprecatedVersions.has(version);
  }

  getSupportedVersions(): string[] {
    return Array.from(this.versions.entries())
      .filter(([_, info]) => info.status !== 'sunset')
      .map(([version]) => version);
  }

  getDeprecatedVersions(): string[] {
    return Array.from(this.deprecatedVersions);
  }

  registerContract(version: string, contract: ApiContract): void {
    if (!this.contracts.has(version)) {
      this.contracts.set(version, []);
    }
    this.contracts.get(version)!.push(contract);
  }

  getContracts(version: string): ApiContract[] {
    return this.contracts.get(version) || [];
  }

  getContract(version: string, endpoint: string, method: string): ApiContract | undefined {
    const contracts = this.contracts.get(version) || [];
    return contracts.find((c) => c.endpoint === endpoint && c.method === method);
  }

  registerDocumentation(version: string, doc: ContractDocumentation): void {
    this.documentation.set(version, doc);
  }

  getDocumentation(version: string): ContractDocumentation | undefined {
    return this.documentation.get(version);
  }

  generateChangelog(fromVersion: string, toVersion: string): ApiChange[] {
    const fromInfo = this.versions.get(fromVersion);
    const toInfo = this.versions.get(toVersion);

    if (!fromInfo || !toInfo) {
      return [];
    }

    const allChanges: ApiChange[] = [];
    const versions = this.getVersionsInRange(fromVersion, toVersion);

    versions.forEach((version) => {
      const info = this.versions.get(version);
      if (info) {
        allChanges.push(...info.changes);
      }
    });

    return allChanges;
  }

  checkCompatibility(fromVersion: string, toVersion: string): {
    compatible: boolean;
    breakingChanges: ApiChange[];
  } {
    const changelog = this.generateChangelog(fromVersion, toVersion);
    const breakingChanges = changelog.filter((change) => change.type === 'breaking');

    return {
      compatible: breakingChanges.length === 0,
      breakingChanges,
    };
  }

  getVersionForRequest(requestVersion?: string): string {
    if (!requestVersion) {
      return this.currentVersion;
    }

    if (this.isVersionSupported(requestVersion)) {
      return requestVersion;
    }

    // Fall back to current version if requested version is not supported
    return this.currentVersion;
  }

  deprecateVersion(version: string, deprecationDate: Date, sunsetDate?: Date): void {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} is not registered`);
    }

    versionInfo.status = 'deprecated';
    versionInfo.deprecationDate = deprecationDate;
    versionInfo.sunsetDate = sunsetDate;

    this.deprecatedVersions.add(version);

    this.logger.warn(`Version ${version} deprecated. Sunset date: ${sunsetDate}`);
  }

  sunsetVersion(version: string): void {
    const versionInfo = this.versions.get(version);
    if (!versionInfo) {
      throw new Error(`Version ${version} is not registered`);
    }

    versionInfo.status = 'sunset';
    this.sunsetVersions.add(version);

    this.logger.warn(`Version ${version} has been sunset`);
  }

  private getVersionsInRange(from: string, to: string): string[] {
    const allVersions = Array.from(this.versions.keys()).sort((a, b) =>
      this.compareVersions(a, b),
    );

    const fromIndex = allVersions.indexOf(from);
    const toIndex = allVersions.indexOf(to);

    if (fromIndex === -1 || toIndex === -1) {
      return [];
    }

    if (fromIndex <= toIndex) {
      return allVersions.slice(fromIndex + 1, toIndex + 1);
    }

    return allVersions.slice(toIndex, fromIndex);
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;

      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }

    return 0;
  }

  getAllVersions(): ApiVersionInfo[] {
    return Array.from(this.versions.values());
  }

  getLatestStableVersion(): string | undefined {
    const stable = Array.from(this.versions.entries())
      .filter(([_, info]) => info.status === 'stable')
      .sort((a, b) => this.compareVersions(a[0], b[0]));

    return stable[stable.length - 1]?.[0];
  }

  validateVersionString(version: string): boolean {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }
}
